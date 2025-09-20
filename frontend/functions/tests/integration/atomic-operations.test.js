import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiTierRateLimiter } from '../../api/multi-tier-rate-limiter.js';
import { IntelligentFallback } from '../../api/intelligent-fallback.js';
import { AppError } from '../../api/error-handler.js';

describe('Atomic Operations Integration', () => {
  let multiTierLimiter;
  let fallback;
  let mockEnv;

  beforeEach(() => {
    // Mock environment with atomic operations support
    mockEnv = {
      RATE_LIMITS_DB: createMockD1Database(),
      RATE_LIMITS: createMockKV(),
      FILE_STORAGE: createMockR2()
    };

    multiTierLimiter = new MultiTierRateLimiter(mockEnv);
    fallback = new IntelligentFallback(mockEnv);
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests atomically without race conditions', async () => {
      // Simulate 50 concurrent requests for the same client/endpoint
      const clientId = 'concurrent-test-client';
      const endpoint = 'uploads';
      const concurrentRequests = 50;
      const rateLimit = 20; // Only 20 should succeed

      // Configure mock D1 to simulate atomic operations
      let requestCount = 0;
      mockEnv.RATE_LIMITS_DB.batch = vi.fn().mockImplementation(() => {
        // Atomic increment with proper race condition protection
        const currentCount = ++requestCount;

        return Promise.resolve([
          { success: true }, // DELETE expired
          { results: [{ current_count: Math.min(currentCount - 1, rateLimit) }] }, // SELECT count
          { results: [] } // SELECT reputation
        ]);
      });

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockImplementation(() => {
          // Simulate atomic insert with conflict handling
          if (requestCount <= rateLimit) {
            return Promise.resolve({ success: true });
          } else {
            throw new Error('Rate limit exceeded in atomic operation');
          }
        }),
        all: vi.fn().mockResolvedValue({ results: [{ reset_time: Date.now() / 1000 + 300 }] })
      });

      // Execute concurrent requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        fallback.intelligentRateLimit(clientId, endpoint, multiTierLimiter)
          .catch(error => ({ error: error.code }))
      );

      const results = await Promise.all(promises);

      // Count successful and rate-limited requests
      const successful = results.filter(r => !r.error && !r.rateLimited).length;
      const rateLimited = results.filter(r => r.error === 'RATE_LIMIT_EXCEEDED').length;

      // Verify atomic behavior: exactly rateLimit requests should succeed
      expect(successful).toBe(rateLimit);
      expect(rateLimited).toBe(concurrentRequests - rateLimit);
      expect(successful + rateLimited).toBe(concurrentRequests);
    });

    it('should maintain consistency across multiple clients', async () => {
      const clientCount = 10;
      const requestsPerClient = 5;
      const rateLimit = 20;

      // Each client should be isolated and get their full quota
      const clientCounters = new Map();

      mockEnv.RATE_LIMITS_DB.batch = vi.fn().mockImplementation(() => {
        // Return different counts for different clients (simulating isolation)
        return Promise.resolve([
          { success: true },
          { results: [{ current_count: 3 }] }, // Each client starts with some existing requests
          { results: [] }
        ]);
      });

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [{ reset_time: Date.now() / 1000 + 300 }] })
      });

      // Execute requests for multiple clients concurrently
      const allPromises = [];
      for (let clientIndex = 0; clientIndex < clientCount; clientIndex++) {
        const clientId = `client-${clientIndex}`;

        for (let reqIndex = 0; reqIndex < requestsPerClient; reqIndex++) {
          allPromises.push(
            fallback.intelligentRateLimit(clientId, 'uploads', multiTierLimiter)
              .then(result => ({ clientId, success: true, result }))
              .catch(error => ({ clientId, success: false, error: error.code }))
          );
        }
      }

      const results = await Promise.all(allPromises);

      // Verify each client got their requests processed independently
      const clientResults = new Map();
      results.forEach(({ clientId, success }) => {
        if (!clientResults.has(clientId)) {
          clientResults.set(clientId, { success: 0, failed: 0 });
        }
        if (success) {
          clientResults.get(clientId).success++;
        } else {
          clientResults.get(clientId).failed++;
        }
      });

      // Each client should have been able to make their requests independently
      expect(clientResults.size).toBe(clientCount);
      for (const [clientId, counts] of clientResults) {
        expect(counts.success).toBe(requestsPerClient);
        expect(counts.failed).toBe(0);
      }
    });
  });

  describe('Transaction Consistency', () => {
    it('should maintain ACID properties during failures', async () => {
      let transactionCount = 0;

      mockEnv.RATE_LIMITS_DB.batch = vi.fn().mockImplementation(() => {
        transactionCount++;

        // Simulate transaction failure on every 3rd attempt
        if (transactionCount % 3 === 0) {
          return Promise.reject(new Error('Transaction failed'));
        }

        return Promise.resolve([
          { success: true },
          { results: [{ current_count: transactionCount - Math.floor(transactionCount / 3) }] },
          { results: [] }
        ]);
      });

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [{ reset_time: Date.now() / 1000 + 300 }] })
      });

      const attempts = 10;
      const results = [];

      for (let i = 0; i < attempts; i++) {
        try {
          const result = await fallback.intelligentRateLimit('test-client', 'uploads', multiTierLimiter);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      // Should have failed on every 3rd transaction
      expect(failed).toBeGreaterThan(0);
      expect(successful).toBeGreaterThan(0);
      expect(successful + failed).toBe(attempts);
    });

    it('should handle database lock timeouts gracefully', async () => {
      let lockTimeoutSimulated = false;

      mockEnv.RATE_LIMITS_DB.batch = vi.fn().mockImplementation(() => {
        if (!lockTimeoutSimulated) {
          lockTimeoutSimulated = true;
          return Promise.reject(new Error('Database lock timeout'));
        }

        return Promise.resolve([
          { success: true },
          { results: [{ current_count: 1 }] },
          { results: [] }
        ]);
      });

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [{ reset_time: Date.now() / 1000 + 300 }] })
      });

      // First request should fail with lock timeout
      const result1 = await fallback.intelligentRateLimit('test-client', 'uploads', multiTierLimiter);
      expect(result1.failOpen).toBe(true);
      expect(result1.error).toContain('Database lock timeout');

      // Second request should succeed
      const result2 = await fallback.intelligentRateLimit('test-client', 'uploads', multiTierLimiter);
      expect(result2.rateLimited).toBe(false);
    });
  });

  describe('Multi-Tier Coordination', () => {
    it('should coordinate between D1 and KV cache consistently', async () => {
      const cacheData = new Map();

      // Mock KV cache behavior
      mockEnv.RATE_LIMITS.get = vi.fn().mockImplementation((key) => {
        return Promise.resolve(cacheData.get(key) ? JSON.stringify(cacheData.get(key)) : null);
      });

      mockEnv.RATE_LIMITS.put = vi.fn().mockImplementation((key, value) => {
        cacheData.set(key, JSON.parse(value));
        return Promise.resolve();
      });

      // Mock D1 behavior
      let d1RequestCount = 0;
      mockEnv.RATE_LIMITS_DB.batch = vi.fn().mockImplementation(() => {
        d1RequestCount++;
        return Promise.resolve([
          { success: true },
          { results: [{ current_count: d1RequestCount }] },
          { results: [] }
        ]);
      });

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [{ reset_time: Date.now() / 1000 + 300 }] })
      });

      const clientId = 'cache-test-client';
      const endpoint = 'uploads';

      // First request should hit D1 and populate cache
      const result1 = await multiTierLimiter.checkRateLimit(clientId, endpoint);
      expect(result1.source).toBe('d1');
      expect(mockEnv.RATE_LIMITS.put).toHaveBeenCalled();

      // Subsequent requests within cache TTL should use cache
      const result2 = await multiTierLimiter.checkRateLimit(clientId, endpoint);
      expect(result2.source).toBe('cache');

      // Verify cache data consistency
      const cacheKey = `rl:${clientId}:${endpoint}`;
      const cachedData = cacheData.get(cacheKey);
      expect(cachedData.current).toBe(result2.current);
    });

    it('should handle cache invalidation properly', async () => {
      const cacheData = new Map();

      mockEnv.RATE_LIMITS.get = vi.fn().mockImplementation((key) => {
        return Promise.resolve(cacheData.get(key) ? JSON.stringify(cacheData.get(key)) : null);
      });

      mockEnv.RATE_LIMITS.put = vi.fn().mockImplementation((key, value) => {
        cacheData.set(key, JSON.parse(value));
        return Promise.resolve();
      });

      mockEnv.RATE_LIMITS.delete = vi.fn().mockImplementation((key) => {
        cacheData.delete(key);
        return Promise.resolve();
      });

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] })
      });

      const clientId = 'invalidation-test';
      const endpoint = 'uploads';

      // Populate cache
      await multiTierLimiter.checkRateLimit(clientId, endpoint);
      expect(cacheData.size).toBeGreaterThan(0);

      // Reset should clear cache
      await multiTierLimiter.resetLimits(clientId, endpoint);

      const cacheKey = `rl:${clientId}:${endpoint}`;
      expect(cacheData.has(cacheKey)).toBe(false);
    });
  });

  describe('Fallback Strategy Verification', () => {
    it('should fallback gracefully when D1 is unavailable', async () => {
      // Simulate D1 unavailability
      fallback.healthStatus.d1.status = 'unhealthy';
      fallback.healthStatus.kv.status = 'healthy';

      mockEnv.RATE_LIMITS.get = vi.fn().mockResolvedValue(null);
      mockEnv.RATE_LIMITS.put = vi.fn().mockResolvedValue();

      const result = await fallback.intelligentRateLimit('test-client', 'uploads', multiTierLimiter);

      expect(result.source).toBe('kv-fallback');
      expect(result.rateLimited).toBe(false);
    });

    it('should fallback to memory when all external storage fails', async () => {
      // Simulate all external storage failures
      fallback.healthStatus.d1.status = 'unhealthy';
      fallback.healthStatus.kv.status = 'unhealthy';

      const result = await fallback.intelligentRateLimit('test-client', 'uploads', multiTierLimiter);

      expect(result.source).toBe('memory-fallback');
      expect(result.rateLimited).toBe(false);
    });

    it('should maintain rate limiting accuracy across fallback transitions', async () => {
      const clientId = 'transition-test';
      const endpoint = 'uploads';
      const rateLimit = 5;

      // Start with healthy D1
      fallback.healthStatus.d1.status = 'healthy';
      fallback.healthStatus.kv.status = 'healthy';

      let requestCount = 0;
      mockEnv.RATE_LIMITS_DB.batch = vi.fn().mockImplementation(() => {
        requestCount++;
        if (requestCount > 3) {
          // Simulate D1 failure after 3 requests
          return Promise.reject(new Error('D1 failure'));
        }
        return Promise.resolve([
          { success: true },
          { results: [{ current_count: requestCount }] },
          { results: [] }
        ]);
      });

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      });

      // Mock KV fallback
      mockEnv.RATE_LIMITS.get = vi.fn().mockResolvedValue(JSON.stringify({
        requests: [1, 2, 3] // 3 existing requests
      }));

      const results = [];

      // Make 6 requests - first 3 on D1, next 3 on KV fallback
      for (let i = 0; i < 6; i++) {
        try {
          const result = await fallback.intelligentRateLimit(clientId, endpoint, multiTierLimiter);
          results.push({ success: true, source: result.source });
        } catch (error) {
          results.push({ success: false, error: error.code });
        }
      }

      // First 3 should succeed on D1
      expect(results.slice(0, 3).every(r => r.success)).toBe(true);

      // Remaining should hit rate limit on KV fallback
      expect(results.slice(3).some(r => !r.success)).toBe(true);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance during sustained concurrent load', async () => {
      const startTime = Date.now();
      const concurrentClients = 20;
      const requestsPerClient = 10;

      mockEnv.RATE_LIMITS_DB.batch = vi.fn().mockResolvedValue([
        { success: true },
        { results: [{ current_count: 5 }] },
        { results: [] }
      ]);

      mockEnv.RATE_LIMITS_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      });

      const allPromises = [];

      for (let clientIndex = 0; clientIndex < concurrentClients; clientIndex++) {
        for (let reqIndex = 0; reqIndex < requestsPerClient; reqIndex++) {
          allPromises.push(
            fallback.intelligentRateLimit(`client-${clientIndex}`, 'uploads', multiTierLimiter)
          );
        }
      }

      const results = await Promise.all(allPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 2 seconds for 200 operations)
      expect(duration).toBeLessThan(2000);
      expect(results).toHaveLength(concurrentClients * requestsPerClient);
      expect(results.every(r => !r.rateLimited)).toBe(true);
    });
  });
});

// Helper functions to create mock objects

function createMockD1Database() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] })
    }),
    batch: vi.fn().mockResolvedValue([
      { success: true },
      { results: [{ current_count: 0 }] },
      { results: [] }
    ])
  };
}

function createMockKV() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(),
    delete: vi.fn().mockResolvedValue()
  };
}

function createMockR2() {
  return {
    put: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [] }),
    delete: vi.fn().mockResolvedValue()
  };
}