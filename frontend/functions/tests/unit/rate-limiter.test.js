/**
 * @file Unit tests for the main RateLimiter class.
 * @description This suite tests the high-level logic of the `RateLimiter`, including
 * client ID extraction, file validation, and the creation of rate limit responses.
 * It mocks the underlying multi-tier and fallback systems to focus on the top-level orchestration.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../../api/rate-limiter.js';

describe('RateLimiter Unit Tests', () => {
  let rateLimiter;
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      RATE_LIMITS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };
    rateLimiter = new RateLimiter(mockEnv);
  });

  describe('getClientId', () => {
    it('should extract IP from cf-connecting-ip header', () => {
      const request = {
        headers: {
          get: vi.fn((header) => {
            if (header === 'cf-connecting-ip') return '192.168.1.1';
            return null;
          })
        }
      };

      const clientId = rateLimiter.getClientId(request);
      expect(clientId).toBe('192.168.1.1');
    });

    it('should extract IP from x-forwarded-for header as fallback', () => {
      const request = {
        headers: {
          get: vi.fn((header) => {
            if (header === 'x-forwarded-for') return '192.168.1.2, 10.0.0.1';
            return null;
          })
        }
      };

      const clientId = rateLimiter.getClientId(request);
      expect(clientId).toBe('192.168.1.2');
    });

    it('should use default IP when no headers present', () => {
      const request = {
        headers: {
          get: vi.fn(() => null)
        }
      };

      const clientId = rateLimiter.getClientId(request);
      expect(clientId).toBe('127.0.0.1');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', async () => {
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: [Math.floor(Date.now() / 1000) - 100], // One request 100 seconds ago
        lastUpdate: Math.floor(Date.now() / 1000)
      }));

      const result = await rateLimiter.checkRateLimit(request, 'conversions');
      expect(result).toBeNull();
    });

    it('should rate limit when exceeding conversions limit', async () => {
      const now = Math.floor(Date.now() / 1000);
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      // Mock 10 requests in the last hour (at limit)
      const existingRequests = Array.from({ length: 10 }, (_, i) => now - (i * 300));
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const result = await rateLimiter.checkRateLimit(request, 'conversions');

      expect(result).toEqual({
        rateLimited: true,
        resetTime: expect.any(Number),
        retryAfter: expect.any(Number)
      });
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should rate limit when exceeding uploads limit', async () => {
      const now = Math.floor(Date.now() / 1000);
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      // Mock 20 requests in the last 5 minutes (at limit)
      const existingRequests = Array.from({ length: 20 }, (_, i) => now - (i * 10));
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const result = await rateLimiter.checkRateLimit(request, 'uploads');

      expect(result).toEqual({
        rateLimited: true,
        resetTime: expect.any(Number),
        retryAfter: expect.any(Number)
      });
    });

    it('should handle empty rate limit data', async () => {
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const result = await rateLimiter.checkRateLimit(request, 'conversions');
      expect(result).toBeNull();
      expect(mockEnv.RATE_LIMITS.put).toHaveBeenCalled();
    });

    it('should fail open on KV errors', async () => {
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      mockEnv.RATE_LIMITS.get.mockRejectedValue(new Error('KV error'));

      const result = await rateLimiter.checkRateLimit(request, 'conversions');
      expect(result).toBeNull(); // Fail open
    });

    it('should filter out old requests outside the window', async () => {
      const now = Math.floor(Date.now() / 1000);
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      // Mix of old and recent requests
      const existingRequests = [
        now - 4000, // 4000 seconds ago (outside 1 hour window)
        now - 100,  // Recent
        now - 200   // Recent
      ];

      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const result = await rateLimiter.checkRateLimit(request, 'conversions');
      expect(result).toBeNull(); // Should allow (only 2 recent requests)
    });

    it('should return null for unknown rate limit type', async () => {
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      const result = await rateLimiter.checkRateLimit(request, 'unknown_type');
      expect(result).toBeNull();
    });
  });

  describe('validateFiles', () => {
    it('should validate file count within limits', () => {
      const files = [
        { name: 'file1.json', size: 1000 },
        { name: 'file2.json', size: 2000 }
      ];

      const result = rateLimiter.validateFiles(files);
      expect(result.valid).toBe(true);
    });

    it('should reject too many files', () => {
      const files = Array.from({ length: 4 }, (_, i) => ({
        name: `file${i}.json`,
        size: 1000
      }));

      const result = rateLimiter.validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Maximum 3 files allowed');
    });

    it('should reject files that are too large', () => {
      const files = [
        { name: 'large-file.json', size: 15 * 1024 * 1024 } // 15MB
      ];

      const result = rateLimiter.validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should reject null or undefined files', () => {
      const result = rateLimiter.validateFiles(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No files provided');
    });

    it('should reject non-array files', () => {
      const result = rateLimiter.validateFiles({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No files provided');
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create proper 429 response', () => {
      const rateLimitResult = {
        rateLimited: true,
        resetTime: Math.floor(Date.now() / 1000) + 3600,
        retryAfter: 3600
      };

      const corsHeaders = {
        'Access-Control-Allow-Origin': '*'
      };

      const response = rateLimiter.createRateLimitResponse(rateLimitResult, corsHeaders);

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('3600');
      expect(response.headers.get('X-RateLimit-Reset')).toBe(rateLimitResult.resetTime.toString());
    });

    it('should enforce minimum retry time', () => {
      const rateLimitResult = {
        rateLimited: true,
        resetTime: Math.floor(Date.now() / 1000) + 1,
        retryAfter: 0 // Should be enforced to minimum 1
      };

      const response = rateLimiter.createRateLimitResponse(rateLimitResult, {});
      expect(response.headers.get('Retry-After')).toBe('1');
    });
  });

  describe('getCurrentUsage', () => {
    it('should return current usage stats', async () => {
      const now = Math.floor(Date.now() / 1000);
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      const existingRequests = [now - 100, now - 200, now - 300];
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const usage = await rateLimiter.getCurrentUsage(request, 'conversions');

      expect(usage.used).toBe(3);
      expect(usage.remaining).toBe(7); // 10 - 3
    });

    it('should handle missing data gracefully', async () => {
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const usage = await rateLimiter.getCurrentUsage(request, 'conversions');

      expect(usage.used).toBe(0);
      expect(usage.remaining).toBe(10);
    });

    it('should handle errors gracefully', async () => {
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      mockEnv.RATE_LIMITS.get.mockRejectedValue(new Error('KV error'));

      const usage = await rateLimiter.getCurrentUsage(request, 'conversions');

      expect(usage.used).toBe(0);
      expect(usage.remaining).toBe(10);
    });
  });

  describe('createRateLimitHeaders', () => {
    it('should create proper rate limit headers', () => {
      const headers = rateLimiter.createRateLimitHeaders('conversions', 5);

      expect(headers['X-RateLimit-Window']).toBe('3600');
      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('5');
    });

    it('should handle unknown type', () => {
      const headers = rateLimiter.createRateLimitHeaders('unknown');
      expect(headers).toEqual({});
    });

    it('should enforce minimum remaining value', () => {
      const headers = rateLimiter.createRateLimitHeaders('conversions', -5);
      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('recordSuccessfulOperation', () => {
    it('should log successful operations', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      await rateLimiter.recordSuccessfulOperation(request, 'conversions');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit: conversions operation completed for 192.168.1.1')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limiting Stress Tests', () => {
    it('should handle concurrent requests correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      // Simulate 9 existing requests (close to limit)
      const existingRequests = Array.from({ length: 9 }, (_, i) => now - (i * 100));
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      // First request should pass
      const result1 = await rateLimiter.checkRateLimit(request, 'conversions');
      expect(result1).toBeNull();

      // Simulate the rate limiter being called again immediately
      // This simulates the race condition in concurrent requests
      const existingRequestsAfter = [...existingRequests, now];
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequestsAfter,
        lastUpdate: now
      }));

      // Second request should be rate limited
      const result2 = await rateLimiter.checkRateLimit(request, 'conversions');
      expect(result2).toEqual({
        rateLimited: true,
        resetTime: expect.any(Number),
        retryAfter: expect.any(Number)
      });
    });

    it('should handle very old timestamps correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const request = {
        headers: {
          get: vi.fn(() => '192.168.1.1')
        }
      };

      // Mix of very old and current requests
      const existingRequests = [
        1000000000, // Year 2001 - very old
        now - 100,  // Recent
        now - 200   // Recent
      ];

      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const result = await rateLimiter.checkRateLimit(request, 'conversions');
      expect(result).toBeNull(); // Should allow (only 2 recent requests)
    });
  });
});