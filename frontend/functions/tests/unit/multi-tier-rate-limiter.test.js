import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MultiTierRateLimiter } from '../../api/multi-tier-rate-limiter.js';
import { AppError } from '../../api/error-handler.js';

describe('MultiTierRateLimiter', () => {
  let multiTierLimiter;
  let mockD1Limiter;
  let mockKV;
  let mockR2;
  let mockEnv;

  beforeEach(() => {
    // Mock D1RateLimiter
    mockD1Limiter = {
      checkRateLimit: vi.fn(),
      getStatus: vi.fn(),
      cleanup: vi.fn(),
      getAnalytics: vi.fn(),
      db: {
        prepare: vi.fn()
      }
    };

    // Mock KV storage
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    // Mock R2 storage
    mockR2 = {
      put: vi.fn(),
      get: vi.fn(),
      list: vi.fn()
    };

    // Mock environment
    mockEnv = {
      RATE_LIMITS_DB: {},
      RATE_LIMITS: mockKV,
      FILE_STORAGE: mockR2
    };

    multiTierLimiter = new MultiTierRateLimiter(mockEnv);
    multiTierLimiter.d1Limiter = mockD1Limiter;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Cache Operations', () => {
    it('should use cache for recent results', async () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedResult = {
        rateLimited: false,
        current: 5,
        max: 20,
        timestamp: now - 15 // 15 seconds ago
      };

      mockKV.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await multiTierLimiter.checkRateLimit('client1', 'uploads');

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(6); // Incremented from cache
      expect(result.source).toBe('cache');
      expect(mockD1Limiter.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should bypass cache for old results', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oldCachedResult = {
        rateLimited: false,
        current: 5,
        max: 20,
        timestamp: now - 60 // 60 seconds ago
      };

      mockKV.get.mockResolvedValue(JSON.stringify(oldCachedResult));
      mockD1Limiter.checkRateLimit.mockResolvedValue({
        rateLimited: false,
        current: 7,
        max: 20
      });

      const result = await multiTierLimiter.checkRateLimit('client1', 'uploads');

      expect(result.source).toBe('d1');
      expect(mockD1Limiter.checkRateLimit).toHaveBeenCalled();
    });

    it('should handle cache failures gracefully', async () => {
      mockKV.get.mockRejectedValue(new Error('Cache read failed'));
      mockD1Limiter.checkRateLimit.mockResolvedValue({
        rateLimited: false,
        current: 1,
        max: 20
      });

      const result = await multiTierLimiter.checkRateLimit('client1', 'uploads');

      expect(result.source).toBe('d1');
      expect(mockD1Limiter.checkRateLimit).toHaveBeenCalled();
    });
  });

  describe('D1 Integration', () => {
    it('should cache D1 results for subsequent requests', async () => {
      mockKV.get.mockResolvedValue(null); // No cache
      mockD1Limiter.checkRateLimit.mockResolvedValue({
        rateLimited: false,
        current: 3,
        max: 20
      });

      const result = await multiTierLimiter.checkRateLimit('client1', 'uploads');

      expect(result.source).toBe('d1');
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('client1:uploads'),
        expect.stringContaining('"current":3'),
        expect.objectContaining({ expirationTtl: 300 })
      );
    });

    it('should cache rate limit errors', async () => {
      mockKV.get.mockResolvedValue(null);
      const rateLimitError = new AppError(
        'Rate limit exceeded',
        429,
        'RATE_LIMIT_EXCEEDED',
        { current: 21, max: 20, resetTime: 1700, retryAfter: 100 }
      );

      mockD1Limiter.checkRateLimit.mockRejectedValue(rateLimitError);

      try {
        await multiTierLimiter.checkRateLimit('client1', 'uploads');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('client1:uploads'),
        expect.stringContaining('"rateLimited":true'),
        expect.any(Object)
      );
    });
  });

  describe('Fallback Behavior', () => {
    it('should use cached fallback when D1 fails', async () => {
      const fallbackData = {
        rateLimited: false,
        current: 5,
        max: 20,
        timestamp: Math.floor(Date.now() / 1000) - 200 // 200 seconds ago
      };

      mockKV.get
        .mockResolvedValueOnce(null) // No recent cache
        .mockResolvedValueOnce(JSON.stringify(fallbackData)); // Fallback cache

      mockD1Limiter.checkRateLimit.mockRejectedValue(new Error('D1 timeout'));

      const result = await multiTierLimiter.checkRateLimit('client1', 'uploads');

      expect(result.source).toBe('fallback');
      expect(result.warning).toContain('cached fallback');
    });

    it('should fail open when all systems fail', async () => {
      mockKV.get.mockResolvedValue(null);
      mockD1Limiter.checkRateLimit.mockRejectedValue(new Error('System failure'));

      const result = await multiTierLimiter.checkRateLimit('client1', 'uploads');

      expect(result.source).toBe('fail-open');
      expect(result.rateLimited).toBe(false);
      expect(result.error).toContain('System failure');
    });
  });

  describe('Status and Reputation', () => {
    it('should get comprehensive status with reputation', async () => {
      const d1Status = {
        uploads: { current: 5, max: 20 },
        conversions: { current: 2, max: 10 }
      };

      const reputation = {
        client_id: 'client1',
        reputation_score: 85,
        risk_level: 'LOW'
      };

      mockD1Limiter.getStatus.mockResolvedValue(d1Status);
      mockKV.get.mockResolvedValue(null); // No reputation cache

      const mockReputationStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [reputation] })
      };
      mockD1Limiter.db.prepare.mockReturnValue(mockReputationStatement);

      const status = await multiTierLimiter.getStatus('client1');

      expect(status.rateLimits).toEqual(d1Status);
      expect(status.reputation).toEqual(reputation);
      expect(status.source).toBe('multi-tier');
    });

    it('should cache reputation data', async () => {
      mockD1Limiter.getStatus.mockResolvedValue({});

      const reputation = { reputation_score: 100, risk_level: 'LOW' };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [reputation] })
      };
      mockD1Limiter.db.prepare.mockReturnValue(mockStatement);

      await multiTierLimiter.getClientReputation('client1');

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('rep:client1'),
        expect.stringContaining('"reputation_score":100'),
        expect.objectContaining({ expirationTtl: 300 })
      );
    });
  });

  describe('Analytics Queuing', () => {
    it('should queue analytics events', () => {
      const result = { rateLimited: false, current: 5, max: 20 };
      const metadata = { userAgent: 'test' };

      multiTierLimiter.queueAnalytics('client1', 'uploads', result, metadata);

      expect(multiTierLimiter.analyticsConfig.buffer).toHaveLength(1);
      expect(multiTierLimiter.analyticsConfig.buffer[0]).toMatchObject({
        clientId: 'client1',
        endpoint: 'uploads',
        rateLimited: false
      });
    });

    it('should flush analytics when buffer is full', async () => {
      // Fill buffer to capacity
      for (let i = 0; i < 100; i++) {
        multiTierLimiter.analyticsConfig.buffer.push({
          timestamp: new Date().toISOString(),
          clientId: `client${i}`,
          endpoint: 'uploads'
        });
      }

      mockR2.put.mockResolvedValue();

      // This should trigger a flush
      multiTierLimiter.queueAnalytics('client101', 'uploads', { rateLimited: false }, {});

      expect(mockR2.put).toHaveBeenCalledWith(
        expect.stringMatching(/analytics\/rate-limits\/\d{4}-\d{2}-\d{2}\/\d{2}\/\d+\.json/),
        expect.stringContaining('"count":100'),
        expect.any(Object)
      );
    });
  });

  describe('Analytics Retrieval', () => {
    it('should get analytics from D1 and R2', async () => {
      const d1Analytics = {
        requests: [{ endpoint: 'uploads', total_requests: 50 }],
        violations: [],
        riskyClients: []
      };

      const r2Objects = {
        objects: [
          { key: 'analytics/rate-limits/2023-12-01/10/123456.json' }
        ]
      };

      const r2Data = {
        json: vi.fn().mockResolvedValue({
          events: [
            { endpoint: 'uploads', rateLimited: false, source: 'cache' },
            { endpoint: 'uploads', rateLimited: true, source: 'd1' }
          ]
        })
      };

      mockD1Limiter.getAnalytics.mockResolvedValue(d1Analytics);
      mockR2.list.mockResolvedValue(r2Objects);
      mockR2.get.mockResolvedValue(r2Data);

      const analytics = await multiTierLimiter.getAnalytics('24h');

      expect(analytics.requests).toEqual(d1Analytics.requests);
      expect(analytics.trends.totalEvents).toBe(2);
      expect(analytics.trends.sources.cache).toBe(1);
      expect(analytics.trends.sources.d1).toBe(1);
      expect(analytics.source).toBe('multi-tier');
    });
  });

  describe('Reset Operations', () => {
    it('should reset limits across all tiers', async () => {
      mockD1Limiter.resetLimits.mockResolvedValue({ success: true });

      const result = await multiTierLimiter.resetLimits('client1', 'uploads');

      expect(result.success).toBe(true);
      expect(mockD1Limiter.resetLimits).toHaveBeenCalledWith('client1', 'uploads');
      expect(mockKV.delete).toHaveBeenCalledWith('rl:client1:uploads');
      expect(mockKV.delete).toHaveBeenCalledWith('rep:client1');
    });

    it('should reset all endpoints for client', async () => {
      mockD1Limiter.resetLimits.mockResolvedValue({ success: true });

      await multiTierLimiter.resetLimits('client1');

      // Should delete all endpoint caches
      expect(mockKV.delete).toHaveBeenCalledWith('rl:client1:uploads');
      expect(mockKV.delete).toHaveBeenCalledWith('rl:client1:conversions');
      expect(mockKV.delete).toHaveBeenCalledWith('rl:client1:validations');
      expect(mockKV.delete).toHaveBeenCalledWith('rl:client1:downloads');
    });
  });

  describe('Maintenance', () => {
    it('should perform maintenance across all tiers', async () => {
      mockD1Limiter.cleanup.mockResolvedValue({ success: true });
      mockR2.put.mockResolvedValue();

      const result = await multiTierLimiter.performMaintenance();

      expect(mockD1Limiter.cleanup).toHaveBeenCalled();
      expect(result.d1Cleanup.success).toBe(true);
      expect(result.analyticsFlush).toBe('success');
    });
  });

  describe('Error Handling', () => {
    it('should handle KV cache write failures gracefully', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockRejectedValue(new Error('Cache write failed'));
      mockD1Limiter.checkRateLimit.mockResolvedValue({
        rateLimited: false,
        current: 1,
        max: 20
      });

      const result = await multiTierLimiter.checkRateLimit('client1', 'uploads');

      expect(result.source).toBe('d1');
      expect(result.rateLimited).toBe(false);
    });

    it('should handle R2 analytics failures gracefully', async () => {
      mockR2.put.mockRejectedValue(new Error('R2 write failed'));

      // Fill buffer to trigger flush
      for (let i = 0; i < 100; i++) {
        multiTierLimiter.analyticsConfig.buffer.push({ event: i });
      }

      // Should not throw error
      await expect(multiTierLimiter.flushAnalytics()).resolves.toBeUndefined();

      // Buffer should not be cleared on error
      expect(multiTierLimiter.analyticsConfig.buffer).toHaveLength(100);
    });
  });
});