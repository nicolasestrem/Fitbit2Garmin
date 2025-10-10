/**
 * @file Unit tests for the RateLimitDO and AtomicRateLimiter classes.
 * @description This suite tests the Durable Object's internal logic for atomic rate
 * limiting and the helper class used to interact with it. It uses mocks for the
 * Durable Object state and environment to ensure isolated testing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitDO, AtomicRateLimiter } from '../../api/rate-limit-do.js';

describe('RateLimitDO (Durable Object)', () => {
  let rateLimitDO;
  let mockState;
  let mockEnv;

  beforeEach(() => {
    mockState = {
      storage: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        setAlarm: vi.fn()
      }
    };

    mockEnv = {
      RATE_LIMIT_DO: {
        get: vi.fn(),
        idFromName: vi.fn()
      }
    };

    rateLimitDO = new RateLimitDO(mockState, mockEnv);
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(rateLimitDO.state).toBe(mockState);
      expect(rateLimitDO.env).toBe(mockEnv);
      expect(rateLimitDO.buckets).toBeInstanceOf(Map);
      expect(rateLimitDO.configs).toEqual({
        uploads: { max: 20, window: 300 },
        conversions: { max: 10, window: 3600 },
        validations: { max: 30, window: 300 },
        suspicious: { max: 100, window: 60 }
      });
    });
  });

  describe('Rate Limit Check', () => {
    beforeEach(() => {
      mockState.storage.get.mockResolvedValue(null);
      mockState.storage.put.mockResolvedValue();
    });

    it('should allow first request within limits', async () => {
      const result = await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, 1000);

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(1);
      expect(result.max).toBe(20);
      expect(mockState.storage.put).toHaveBeenCalledWith('client1:uploads', {
        requests: [1000],
        lastUpdate: 1000,
        resetTime: null
      });
    });

    it('should enforce rate limits when exceeded', async () => {
      // Pre-fill bucket with maximum requests
      const bucket = {
        requests: Array.from({ length: 20 }, (_, i) => 1000 + i),
        lastUpdate: 1019,
        resetTime: 1300
      };
      rateLimitDO.buckets.set('client1:uploads', bucket);

      const result = await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, 1020);

      expect(result.rateLimited).toBe(true);
      expect(result.current).toBe(20);
      expect(result.max).toBe(20);
      expect(result.resetTime).toBe(1300); // 1000 + 300 window
      expect(result.retryAfter).toBe(280); // 1300 - 1020
    });

    it('should clean expired requests from sliding window', async () => {
      // Create bucket with mix of old and new requests
      const now = 2000;
      const bucket = {
        requests: [1500, 1600, 1750, 1800, 1900], // Only last 3 should remain (window = 300)
        lastUpdate: 1900,
        resetTime: null
      };
      rateLimitDO.buckets.set('client1:uploads', bucket);

      const result = await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, now);

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(4); // 3 remaining + new request
      expect(bucket.requests).toEqual([1750, 1800, 1900, 2000]);
    });

    it('should handle different endpoint configurations', async () => {
      // Test conversions endpoint (10 max, 3600 window)
      const result = await rateLimitDO.checkRateLimit('client1', 'conversions', rateLimitDO.configs.conversions, 1000);

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(1);
      expect(result.max).toBe(10);
    });

    it('should isolate rate limits between clients', async () => {
      // Add requests for client1
      await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, 1000);
      await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, 1001);

      // Client2 should start fresh
      const result = await rateLimitDO.checkRateLimit('client2', 'uploads', rateLimitDO.configs.uploads, 1002);

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(1);
    });
  });

  describe('Bucket Management', () => {
    it('should create new bucket when none exists', async () => {
      mockState.storage.get.mockResolvedValue(null);

      const bucket = await rateLimitDO.getBucket('client1:uploads');

      expect(bucket.requests).toEqual([]);
      expect(bucket.lastUpdate).toBeCloseTo(Math.floor(Date.now() / 1000), 1);
      expect(bucket.resetTime).toBeNull();
    });

    it('should load bucket from storage when not in memory', async () => {
      const storedBucket = {
        requests: [1000, 1001],
        lastUpdate: 1001,
        resetTime: 1300
      };
      mockState.storage.get.mockResolvedValue(storedBucket);

      const bucket = await rateLimitDO.getBucket('client1:uploads');

      expect(bucket).toEqual(storedBucket);
      expect(rateLimitDO.buckets.get('client1:uploads')).toEqual(storedBucket);
    });

    it('should use memory cache when available', async () => {
      const cachedBucket = {
        requests: [1000, 1001],
        lastUpdate: 1001,
        resetTime: 1300
      };
      rateLimitDO.buckets.set('client1:uploads', cachedBucket);

      const bucket = await rateLimitDO.getBucket('client1:uploads');

      expect(bucket).toEqual(cachedBucket);
      expect(mockState.storage.get).not.toHaveBeenCalled();
    });

    it('should save bucket to both memory and storage', async () => {
      const bucket = {
        requests: [1000],
        lastUpdate: 1000,
        resetTime: null
      };

      await rateLimitDO.saveBucket('client1:uploads', bucket);

      expect(rateLimitDO.buckets.get('client1:uploads')).toEqual(bucket);
      expect(mockState.storage.put).toHaveBeenCalledWith('client1:uploads', bucket);
    });
  });

  describe('HTTP Interface', () => {
    it('should handle rate limit check requests', async () => {
      const request = new Request('https://test/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'client1',
          endpoint: 'uploads',
          timestamp: 1000
        })
      });

      const response = await rateLimitDO.fetch(request);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(1);
    });

    it('should handle status requests', async () => {
      // Add some requests first
      await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, 1000);
      await rateLimitDO.checkRateLimit('client1', 'conversions', rateLimitDO.configs.conversions, 1000);

      const request = new Request('https://test/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'client1' })
      });

      const response = await rateLimitDO.fetch(request);

      expect(response.status).toBe(200);
      const status = await response.json();
      expect(status.uploads.current).toBe(1);
      expect(status.uploads.max).toBe(20);
      expect(status.conversions.current).toBe(1);
      expect(status.conversions.max).toBe(10);
    });

    it('should handle reset requests', async () => {
      // Add some requests first
      await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, 1000);

      const request = new Request('https://test/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'client1',
          endpoint: 'uploads'
        })
      });

      const response = await rateLimitDO.fetch(request);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(rateLimitDO.buckets.has('client1:uploads')).toBe(false);
      expect(mockState.storage.delete).toHaveBeenCalledWith('client1:uploads');
    });

    it('should return 400 for invalid actions', async () => {
      const request = new Request('https://test/invalid', {
        method: 'POST'
      });

      const response = await rateLimitDO.fetch(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing parameters', async () => {
      const request = new Request('https://test/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'client1' }) // Missing endpoint
      });

      const response = await rateLimitDO.fetch(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Alarm Handler', () => {
    it('should clean up old buckets', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oldTime = now - 8000; // 2+ hours ago

      // Add old and new buckets
      rateLimitDO.buckets.set('old:uploads', { requests: [], lastUpdate: oldTime });
      rateLimitDO.buckets.set('new:uploads', { requests: [], lastUpdate: now - 100 });

      await rateLimitDO.alarm();

      expect(rateLimitDO.buckets.has('old:uploads')).toBe(false);
      expect(rateLimitDO.buckets.has('new:uploads')).toBe(true);
      expect(mockState.storage.delete).toHaveBeenCalledWith('old:uploads');
      expect(mockState.storage.setAlarm).toHaveBeenCalled();
    });
  });

  describe('Sliding Window Edge Cases', () => {
    it('should handle requests at exact window boundary', async () => {
      const now = 2000;
      const windowStart = now - 300; // 1700

      const bucket = {
        requests: [1700, 1800, 1900], // First request at exact boundary
        lastUpdate: 1900,
        resetTime: null
      };
      rateLimitDO.buckets.set('client1:uploads', bucket);

      const result = await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, now);

      // Request at 1700 should be excluded (not > windowStart)
      expect(result.current).toBe(3); // 1800, 1900, 2000
      expect(bucket.requests).toEqual([1800, 1900, 2000]);
    });

    it('should update reset time when cleaning expired requests', async () => {
      const now = 2000;
      const bucket = {
        requests: [1500, 1600, 1800, 1900], // First two expire
        lastUpdate: 1900,
        resetTime: 1800 // Should be updated
      };
      rateLimitDO.buckets.set('client1:uploads', bucket);

      await rateLimitDO.checkRateLimit('client1', 'uploads', rateLimitDO.configs.uploads, now);

      expect(bucket.resetTime).toBe(2100); // 1800 + 300
    });

    it('should handle rapid sequential requests', async () => {
      const baseTime = 1000;

      // Simulate 15 rapid requests
      for (let i = 0; i < 15; i++) {
        const result = await rateLimitDO.checkRateLimit(
          'client1',
          'uploads',
          rateLimitDO.configs.uploads,
          baseTime + i
        );
        expect(result.rateLimited).toBe(false);
        expect(result.current).toBe(i + 1);
      }

      // 16th request should still be allowed (under limit of 20)
      const result = await rateLimitDO.checkRateLimit(
        'client1',
        'uploads',
        rateLimitDO.configs.uploads,
        baseTime + 15
      );
      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(16);
    });
  });
});

describe('AtomicRateLimiter', () => {
  let atomicLimiter;
  let mockEnv;
  let mockStub;

  beforeEach(() => {
    mockStub = {
      fetch: vi.fn()
    };

    mockEnv = {
      RATE_LIMIT_DO: {
        idFromName: vi.fn().mockReturnValue('test-id'),
        get: vi.fn().mockReturnValue(mockStub)
      }
    };

    atomicLimiter = new AtomicRateLimiter(mockEnv);
  });

  describe('checkRateLimit', () => {
    it('should successfully check rate limit via Durable Object', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          rateLimited: false,
          current: 1,
          max: 20
        })
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await atomicLimiter.checkRateLimit('client1', 'uploads');

      expect(mockEnv.RATE_LIMIT_DO.idFromName).toHaveBeenCalledWith('client1');
      expect(mockStub.fetch).toHaveBeenCalledWith('https://rate-limit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'client1',
          endpoint: 'uploads',
          timestamp: expect.any(Number)
        })
      });
      expect(result.rateLimited).toBe(false);
    });

    it('should throw AppError when rate limited', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          rateLimited: true,
          current: 21,
          max: 20,
          retryAfter: 150,
          resetTime: 1300
        })
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      await expect(atomicLimiter.checkRateLimit('client1', 'uploads')).rejects.toThrow();
    });

    it('should fail open when Durable Object is unavailable', async () => {
      mockStub.fetch.mockRejectedValue(new Error('Rate limit check failed: 500'));

      const result = await atomicLimiter.checkRateLimit('client1', 'uploads');

      expect(result.rateLimited).toBe(false);
      expect(result.failOpen).toBe(true);
    });

    it('should handle non-rate-limit errors by rethrowing', async () => {
      mockStub.fetch.mockRejectedValue(new Error('Network error'));

      await expect(atomicLimiter.checkRateLimit('client1', 'uploads')).rejects.toThrow('Network error');
    });
  });

  describe('getStatus', () => {
    it('should get status from Durable Object', async () => {
      const mockStatus = {
        uploads: { current: 5, max: 20 },
        conversions: { current: 2, max: 10 }
      };
      const mockResponse = {
        json: vi.fn().mockResolvedValue(mockStatus)
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await atomicLimiter.getStatus('client1');

      expect(result).toEqual(mockStatus);
      expect(mockStub.fetch).toHaveBeenCalledWith('https://rate-limit/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'client1' })
      });
    });

    it('should return empty object on error', async () => {
      mockStub.fetch.mockRejectedValue(new Error('Network error'));

      const result = await atomicLimiter.getStatus('client1');

      expect(result).toEqual({});
    });
  });

  describe('resetLimits', () => {
    it('should reset limits via Durable Object', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({ success: true })
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await atomicLimiter.resetLimits('client1', 'uploads');

      expect(result.success).toBe(true);
      expect(mockStub.fetch).toHaveBeenCalledWith('https://rate-limit/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'client1',
          endpoint: 'uploads'
        })
      });
    });

    it('should handle reset errors gracefully', async () => {
      mockStub.fetch.mockRejectedValue(new Error('Reset failed'));

      const result = await atomicLimiter.resetLimits('client1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Reset failed');
    });
  });
});