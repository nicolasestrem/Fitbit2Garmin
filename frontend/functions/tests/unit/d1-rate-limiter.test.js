import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { D1RateLimiter } from '../../api/d1-rate-limiter.js';
import { AppError } from '../../api/error-handler.js';

describe('D1RateLimiter', () => {
  let rateLimiter;
  let mockD1;
  let mockKV;
  let mockEnv;

  beforeEach(() => {
    // Mock D1 database
    mockD1 = {
      prepare: vi.fn(),
      batch: vi.fn()
    };

    // Mock KV storage
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    // Mock environment
    mockEnv = {
      RATE_LIMITS_DB: mockD1,
      RATE_LIMITS: mockKV
    };

    rateLimiter = new D1RateLimiter(mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should load configuration from D1 database', async () => {
      const mockStatement = {
        all: vi.fn().mockResolvedValue({
          results: [
            { endpoint: 'uploads', max_requests: 20, window_size: 300, burst_allowance: 0, enabled: 1 },
            { endpoint: 'conversions', max_requests: 10, window_size: 3600, burst_allowance: 0, enabled: 1 }
          ]
        })
      };

      mockD1.prepare.mockReturnValue(mockStatement);

      await rateLimiter.loadConfig();

      expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT endpoint'));
      expect(rateLimiter.configs.get('uploads')).toEqual({
        max: 20,
        window: 300,
        burst: 0,
        enabled: true
      });
      expect(rateLimiter.configs.get('conversions')).toEqual({
        max: 10,
        window: 3600,
        burst: 0,
        enabled: true
      });
    });

    it('should use fallback configuration when D1 fails', async () => {
      mockD1.prepare.mockImplementation(() => {
        throw new Error('D1 connection failed');
      });

      await rateLimiter.loadConfig();

      // Should have fallback configs
      expect(rateLimiter.configs.get('uploads')).toEqual({
        max: 20,
        window: 300,
        burst: 0,
        enabled: true
      });
    });
  });

  describe('Atomic Rate Limiting', () => {
    beforeEach(async () => {
      // Mock loaded configuration
      rateLimiter.configs.set('uploads', { max: 20, window: 300, burst: 0, enabled: true });
    });

    it('should allow request within limits', async () => {
      const mockBatchResult = [
        { success: true }, // DELETE
        { results: [{ current_count: 5 }] }, // SELECT count
        { results: [] } // SELECT reputation
      ];

      const mockInsertStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      };

      mockD1.batch.mockResolvedValue(mockBatchResult);
      mockD1.prepare.mockReturnValue(mockInsertStatement);

      const result = await rateLimiter.checkRateLimit('client1', 'uploads');

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(6);
      expect(result.max).toBe(20);
      expect(mockD1.batch).toHaveBeenCalled();
      expect(mockInsertStatement.run).toHaveBeenCalled();
    });

    it('should block request when limit exceeded', async () => {
      const mockBatchResult = [
        { success: true }, // DELETE
        { results: [{ current_count: 20 }] }, // SELECT count (at limit)
        { results: [] } // SELECT reputation
      ];

      mockD1.batch.mockResolvedValue(mockBatchResult);

      // Mock getResetTime
      const mockResetTimeStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [{ reset_time: 1700 }]
        })
      };
      mockD1.prepare.mockReturnValue(mockResetTimeStatement);

      await expect(rateLimiter.checkRateLimit('client1', 'uploads'))
        .rejects
        .toThrow(AppError);

      try {
        await rateLimiter.checkRateLimit('client1', 'uploads');
      } catch (error) {
        expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(error.details.current).toBe(20);
        expect(error.details.max).toBe(20);
      }
    });

    it('should apply reputation-based limit adjustments', async () => {
      const mockBatchResult = [
        { success: true }, // DELETE
        { results: [{ current_count: 7 }] }, // SELECT count
        { results: [{ reputation_score: 50, risk_level: 'MEDIUM' }] } // SELECT reputation
      ];

      mockD1.batch.mockResolvedValue(mockBatchResult);

      // Mock getResetTime for rate limit error
      const mockResetTimeStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [{ reset_time: 1700 }]
        })
      };
      mockD1.prepare.mockReturnValue(mockResetTimeStatement);

      // With MEDIUM risk (60% of limit), 7 requests should exceed limit of 12 (20 * 0.6)
      await expect(rateLimiter.checkRateLimit('client1', 'uploads'))
        .rejects
        .toThrow(AppError);
    });

    it('should handle D1 failures gracefully with fail-open', async () => {
      mockD1.batch.mockRejectedValue(new Error('D1 connection timeout'));

      const result = await rateLimiter.checkRateLimit('client1', 'uploads');

      expect(result.rateLimited).toBe(false);
      expect(result.failOpen).toBe(true);
      expect(result.error).toContain('D1 connection timeout');
    });
  });

  describe('Reputation System', () => {
    it('should calculate effective limits based on reputation', () => {
      const baseLimit = 20;

      // Test different risk levels
      expect(rateLimiter.getEffectiveLimit(baseLimit, { risk_level: 'LOW' })).toBe(20);
      expect(rateLimiter.getEffectiveLimit(baseLimit, { risk_level: 'MEDIUM' })).toBe(12); // 60%
      expect(rateLimiter.getEffectiveLimit(baseLimit, { risk_level: 'HIGH' })).toBe(6); // 30%
      expect(rateLimiter.getEffectiveLimit(baseLimit, { risk_level: 'CRITICAL' })).toBe(2); // 10%
    });

    it('should use base limit when no reputation data', () => {
      expect(rateLimiter.getEffectiveLimit(20, null)).toBe(20);
      expect(rateLimiter.getEffectiveLimit(20, undefined)).toBe(20);
    });
  });

  describe('Violation Recording', () => {
    it('should record rate limit violations', async () => {
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      };

      mockD1.prepare.mockReturnValue(mockStatement);

      await rateLimiter.recordViolation(
        'client1',
        'uploads',
        25,
        20,
        300,
        { userAgent: 'test-agent' }
      );

      expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO rate_limit_violations'));
      expect(mockStatement.bind).toHaveBeenCalledWith(
        'client1',
        'uploads',
        'BURST_ATTACK', // 25/20 = 1.25, >= 1.5 = SUSPICIOUS, >= 3 = BURST_ATTACK
        expect.any(Number),
        25,
        20,
        300,
        null,
        'test-agent',
        expect.any(String)
      );
    });

    it('should determine correct violation types', () => {
      expect(rateLimiter.getViolationType(25, 20)).toBe('BURST_ATTACK'); // ratio >= 3
      expect(rateLimiter.getViolationType(30, 20)).toBe('SUSPICIOUS_PATTERN'); // ratio >= 1.5
      expect(rateLimiter.getViolationType(21, 20)).toBe('RATE_EXCEEDED'); // ratio < 1.5
    });
  });

  describe('Status and Analytics', () => {
    beforeEach(async () => {
      rateLimiter.configs.set('uploads', { max: 20, window: 300 });
      rateLimiter.configs.set('conversions', { max: 10, window: 3600 });
    });

    it('should get status for all endpoints', async () => {
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn()
          .mockResolvedValueOnce({ results: [{ current_count: 5 }] }) // uploads
          .mockResolvedValueOnce({ results: [{ reset_time: 1700 }] }) // uploads reset
          .mockResolvedValueOnce({ results: [{ current_count: 2 }] }) // conversions
          .mockResolvedValueOnce({ results: [{ reset_time: 4600 }] }) // conversions reset
      };

      mockD1.prepare.mockReturnValue(mockStatement);

      const status = await rateLimiter.getStatus('client1');

      expect(status.uploads.current).toBe(5);
      expect(status.uploads.max).toBe(20);
      expect(status.conversions.current).toBe(2);
      expect(status.conversions.max).toBe(10);
    });

    it('should get analytics data', async () => {
      const mockAnalytics = {
        requests: [{ endpoint: 'uploads', total_requests: 100 }],
        violations: [{ violation_type: 'RATE_EXCEEDED', violation_count: 5 }],
        riskyClients: [{ client_id: 'bad-client', reputation_score: 25 }]
      };

      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn()
          .mockResolvedValueOnce({ results: mockAnalytics.requests })
          .mockResolvedValueOnce({ results: mockAnalytics.violations })
          .mockResolvedValueOnce({ results: mockAnalytics.riskyClients })
      };

      mockD1.prepare.mockReturnValue(mockStatement);

      const analytics = await rateLimiter.getAnalytics('24h');

      expect(analytics.requests).toEqual(mockAnalytics.requests);
      expect(analytics.violations).toEqual(mockAnalytics.violations);
      expect(analytics.riskyClients).toEqual(mockAnalytics.riskyClients);
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset limits for specific endpoint', async () => {
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      };

      mockD1.prepare.mockReturnValue(mockStatement);

      const result = await rateLimiter.resetLimits('client1', 'uploads');

      expect(result.success).toBe(true);
      expect(mockStatement.bind).toHaveBeenCalledWith('client1', 'uploads');
    });

    it('should reset all limits for client', async () => {
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      };

      mockD1.prepare.mockReturnValue(mockStatement);

      const result = await rateLimiter.resetLimits('client1');

      expect(result.success).toBe(true);
      expect(mockStatement.bind).toHaveBeenCalledWith('client1');
    });

    it('should cleanup old data', async () => {
      const mockBatchResult = [
        { success: true },
        { success: true }
      ];

      mockD1.batch.mockResolvedValue(mockBatchResult);

      const result = await rateLimiter.cleanup();

      expect(result.success).toBe(true);
      expect(mockD1.batch).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle disabled endpoints', async () => {
      rateLimiter.configs.set('disabled-endpoint', { enabled: false });

      const result = await rateLimiter.checkRateLimit('client1', 'disabled-endpoint');

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(0);
      expect(result.max).toBe(0);
    });

    it('should handle unknown endpoints', async () => {
      const result = await rateLimiter.checkRateLimit('client1', 'unknown-endpoint');

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(0);
      expect(result.max).toBe(0);
    });

    it('should handle database transaction failures', async () => {
      rateLimiter.configs.set('uploads', { max: 20, window: 300, enabled: true });

      mockD1.batch.mockRejectedValue(new Error('Transaction failed'));

      const result = await rateLimiter.checkRateLimit('client1', 'uploads');

      expect(result.failOpen).toBe(true);
      expect(result.error).toContain('Transaction failed');
    });
  });
});