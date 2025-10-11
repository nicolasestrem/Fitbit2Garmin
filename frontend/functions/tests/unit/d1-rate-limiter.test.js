/**
 * @file Unit tests for the D1RateLimiter class.
 * @description This test suite uses `vitest` to mock the D1 database and KV
 * dependencies, allowing for isolated testing of the rate limiter's logic,
 * including its atomic operations, reputation adjustments, and cleanup procedures.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { D1RateLimiter } from '../../api/d1-rate-limiter.js';
import { AppError } from '../../api/error-handler.js';

describe('D1RateLimiter Unit Tests', () => {
  let rateLimiter;
  let mockD1;
  let mockKV;
  let mockEnv;
  let mockStatement;

  beforeEach(() => {
    // A robust, chainable mock for D1 statements
    mockStatement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
    };

    // Mock D1 database that always returns the statement mock
    mockD1 = {
      prepare: vi.fn(() => mockStatement),
      batch: vi.fn(),
    };

    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockEnv = {
      RATE_LIMITS_DB: mockD1,
      RATE_LIMITS: mockKV,
    };

    rateLimiter = new D1RateLimiter(mockEnv);
    // Pre-load a default config for most tests
    rateLimiter.configs.set('uploads', { max: 20, window: 300, burst: 0, enabled: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow a request when under the limit', async () => {
      mockD1.batch.mockResolvedValue([
        { success: true },
        { results: [{ current_count: 5 }] },
        { results: [] },
      ]);

      const result = await rateLimiter.checkRateLimit('client1', 'uploads');

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(6);
    });

    it('should throw an AppError when the limit is exceeded', async () => {
      mockD1.batch.mockResolvedValue([
        { success: true },
        { results: [{ current_count: 20 }] },
        { results: [] },
      ]);

      await expect(rateLimiter.checkRateLimit('client1', 'uploads')).rejects.toThrow(AppError);
    });

    it('should propagate D1 batch failures', async () => {
      mockD1.batch.mockRejectedValue(new Error('D1 connection timeout'));

      await expect(rateLimiter.checkRateLimit('client1', 'uploads')).rejects.toThrow('D1 connection timeout');
    });

    it('should correctly apply reputation-based limit adjustments', async () => {
        mockD1.batch.mockResolvedValue([
          { success: true },
          { results: [{ current_count: 12 }] }, // 12 requests so far
          { results: [{ reputation_score: 50, risk_level: 'MEDIUM' }] }
        ]);

        // MEDIUM risk reduces limit to 60% of 20, which is 12.
        // Since currentCount (12) >= effectiveMax (12), it should be rate limited.
        await expect(rateLimiter.checkRateLimit('client1', 'uploads')).rejects.toThrow(AppError);
      });
  });

  describe('getViolationType', () => {
    it('should correctly classify violation types', () => {
      expect(rateLimiter.getViolationType(21, 20)).toBe('RATE_EXCEEDED');
      expect(rateLimiter.getViolationType(30, 20)).toBe('SUSPICIOUS_PATTERN');
      expect(rateLimiter.getViolationType(59, 20)).toBe('SUSPICIOUS_PATTERN');
      expect(rateLimiter.getViolationType(60, 20)).toBe('BURST_ATTACK');
    });
  });

  describe('cleanup', () => {
    it('should execute cleanup batch successfully', async () => {
      mockD1.batch.mockResolvedValue([{ success: true }, { success: true }]);
      const result = await rateLimiter.cleanup();
      expect(result.success).toBe(true);
      expect(mockD1.batch).toHaveBeenCalledTimes(1);
    });

    it('should return success false if cleanup fails', async () => {
        mockD1.batch.mockRejectedValue(new Error('Cleanup failed'));
        const result = await rateLimiter.cleanup();
        expect(result.success).toBe(false);
        expect(result.error).toBe('Cleanup failed');
      });
  });

  describe('resetLimits', () => {
    it('should return success false if reset fails', async () => {
      mockStatement.run.mockRejectedValue(new Error('Reset failed'));
      const result = await rateLimiter.resetLimits('client1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Reset failed');
    });
  });
});