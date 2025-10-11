/**
 * @file Unit tests for the IntelligentFallback class.
 * @description This suite tests the system's ability to gracefully handle component
 * failures. It uses mocks to simulate unhealthy components (D1, KV, R2) and
 * verifies that the system correctly falls back to the next available strategy,
 * from the multi-tier limiter down to an in-memory solution.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IntelligentFallback } from '../../api/intelligent-fallback.js';
import { AppError } from '../../api/error-handler.js';

describe('IntelligentFallback Unit Tests', () => {
  let fallback;
  let mockEnv;
  let mockPrimaryLimiter;

  beforeEach(() => {
    mockEnv = {
      RATE_LIMITS_DB: {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true })
        })
      },
      RATE_LIMITS: {
        put: vi.fn().mockResolvedValue(),
        get: vi.fn().mockResolvedValue('test'),
        delete: vi.fn().mockResolvedValue()
      },
      FILE_STORAGE: {
        put: vi.fn().mockResolvedValue(),
        get: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue()
      }
    };

    mockPrimaryLimiter = {
      checkRateLimit: vi.fn(),
      d1Limiter: {
        checkRateLimit: vi.fn()
      }
    };

    fallback = new IntelligentFallback(mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Checking', () => {
    it('should check D1 health successfully', async () => {
      await fallback.checkD1Health();

      expect(fallback.healthStatus.d1.status).toBe('healthy');
      expect(fallback.healthStatus.d1.failures).toBe(0);
      expect(fallback.healthStatus.d1.latency).toBeGreaterThan(0);
    });

    it('should detect D1 failures', async () => {
      mockEnv.RATE_LIMITS_DB.prepare.mockImplementation(() => {
        throw new Error('D1 connection failed');
      });

      await fallback.checkD1Health();

      expect(fallback.healthStatus.d1.status).toBe('degraded');
      expect(fallback.healthStatus.d1.failures).toBe(1);
      expect(fallback.healthStatus.d1.lastError).toContain('D1 connection failed');
    });

    it('should check KV health successfully', async () => {
      await fallback.checkKVHealth();

      expect(fallback.healthStatus.kv.status).toBe('healthy');
      expect(fallback.healthStatus.kv.failures).toBe(0);
    });

    it('should detect KV failures', async () => {
      mockEnv.RATE_LIMITS.put.mockRejectedValue(new Error('KV write failed'));

      await fallback.checkKVHealth();

      expect(fallback.healthStatus.kv.status).toBe('degraded');
      expect(fallback.healthStatus.kv.failures).toBe(1);
    });

    it('should check R2 health successfully', async () => {
      await fallback.checkR2Health();

      expect(fallback.healthStatus.r2.status).toBe('healthy');
      expect(fallback.healthStatus.r2.failures).toBe(0);
    });

    it('should mark component unhealthy after failure threshold', async () => {
      // Simulate 3 consecutive failures
      mockEnv.RATE_LIMITS_DB.prepare.mockImplementation(() => {
        throw new Error('Persistent failure');
      });

      for (let i = 0; i < 3; i++) {
        await fallback.checkD1Health();
      }

      expect(fallback.healthStatus.d1.status).toBe('unhealthy');
      expect(fallback.healthStatus.d1.failures).toBe(3);
      expect(fallback.healthStatus.d1.circuitBreakerUntil).toBeGreaterThan(Date.now());
    });
  });

  describe('Component Availability', () => {
    it('should determine full strategy when all components available', async () => {
      // Set all components healthy
      fallback.healthStatus.d1.status = 'healthy';
      fallback.healthStatus.kv.status = 'healthy';
      fallback.healthStatus.r2.status = 'healthy';

      const { strategy, components } = fallback.getAvailableComponents();

      expect(strategy).toBe('full');
      expect(components.d1).toBe(true);
      expect(components.kv).toBe(true);
      expect(components.r2).toBe(true);
    });

    it('should determine d1-only strategy when KV fails', async () => {
      fallback.healthStatus.d1.status = 'healthy';
      fallback.healthStatus.kv.status = 'unhealthy';
      fallback.healthStatus.r2.status = 'healthy';

      const { strategy } = fallback.getAvailableComponents();

      expect(strategy).toBe('d1-only');
    });

    it('should determine kv-only strategy when D1 fails', async () => {
      fallback.healthStatus.d1.status = 'unhealthy';
      fallback.healthStatus.kv.status = 'healthy';

      const { strategy } = fallback.getAvailableComponents();

      expect(strategy).toBe('kv-only');
    });

    it('should determine memory-only strategy when all fail', async () => {
      fallback.healthStatus.d1.status = 'unhealthy';
      fallback.healthStatus.kv.status = 'unhealthy';
      fallback.healthStatus.r2.status = 'unhealthy';

      const { strategy } = fallback.getAvailableComponents();

      expect(strategy).toBe('memory-only');
    });
  });

  describe('Memory Rate Limiting', () => {
    it('should allow requests within memory limits', async () => {
      const config = { max: 5, window: 300 };

      const result = await fallback.memoryRateLimit('client1', 'uploads', config);

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(1);
      expect(result.source).toBe('memory-fallback');
    });

    it('should block requests when memory limits exceeded', async () => {
      const config = { max: 2, window: 300 };

      // First two requests should pass
      await fallback.memoryRateLimit('client1', 'uploads', config);
      await fallback.memoryRateLimit('client1', 'uploads', config);

      // Third should fail
      await expect(fallback.memoryRateLimit('client1', 'uploads', config))
        .rejects
        .toThrow(AppError);
    });

    it('should clean expired requests from memory', async () => {
      const config = { max: 2, window: 1 }; // 1 second window

      // Add a request
      await fallback.memoryRateLimit('client1', 'uploads', config);

      // Mock time progression
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(originalNow() + 2000); // 2 seconds later

      // Should allow new request as old one expired
      const result = await fallback.memoryRateLimit('client1', 'uploads', config);

      expect(result.current).toBe(1); // Old request cleaned up

      Date.now = originalNow;
    });
  });

  describe('KV-Only Rate Limiting', () => {
    it('should allow requests within KV limits', async () => {
      const config = { max: 5, window: 300 };

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null); // No existing data

      const result = await fallback.kvOnlyRateLimit('client1', 'uploads', config);

      expect(result.rateLimited).toBe(false);
      expect(result.current).toBe(1);
      expect(result.source).toBe('kv-fallback');
      expect(mockEnv.RATE_LIMITS.put).toHaveBeenCalled();
    });

    it('should block requests when KV limits exceeded', async () => {
      const config = { max: 2, window: 300 };
      const now = Math.floor(Date.now() / 1000);

      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: [now - 100, now - 50] // Two requests within window
      }));

      await expect(fallback.kvOnlyRateLimit('client1', 'uploads', config))
        .rejects
        .toThrow(AppError);
    });

    it('should fall back to memory when KV fails', async () => {
      const config = { max: 5, window: 300 };

      mockEnv.RATE_LIMITS.get.mockRejectedValue(new Error('KV read failed'));

      const result = await fallback.kvOnlyRateLimit('client1', 'uploads', config);

      expect(result.source).toBe('memory-fallback');
    });
  });

  describe('Intelligent Rate Limiting', () => {
    it('should use full strategy when all components healthy', async () => {
      fallback.healthStatus.d1.status = 'healthy';
      fallback.healthStatus.kv.status = 'healthy';

      mockPrimaryLimiter.checkRateLimit.mockResolvedValue({
        rateLimited: false,
        current: 1,
        max: 20
      });

      const result = await fallback.intelligentRateLimit('client1', 'uploads', mockPrimaryLimiter);

      expect(result.rateLimited).toBe(false);
      expect(mockPrimaryLimiter.checkRateLimit).toHaveBeenCalled();
    });

    it('should use D1-only strategy when KV unhealthy', async () => {
      fallback.healthStatus.d1.status = 'healthy';
      fallback.healthStatus.kv.status = 'unhealthy';

      mockPrimaryLimiter.d1Limiter.checkRateLimit.mockResolvedValue({
        rateLimited: false,
        current: 1,
        max: 20
      });

      const result = await fallback.intelligentRateLimit('client1', 'uploads', mockPrimaryLimiter);

      expect(result.rateLimited).toBe(false);
      expect(mockPrimaryLimiter.d1Limiter.checkRateLimit).toHaveBeenCalled();
    });

    it('should use memory strategy when all fail', async () => {
      fallback.healthStatus.d1.status = 'unhealthy';
      fallback.healthStatus.kv.status = 'unhealthy';

      const result = await fallback.intelligentRateLimit('client1', 'uploads', mockPrimaryLimiter);

      expect(result.source).toBe('memory-fallback');
    });

    it('should propagate rate limit errors', async () => {
      fallback.healthStatus.d1.status = 'healthy';
      fallback.healthStatus.kv.status = 'healthy';

      const rateLimitError = new AppError(
        'Rate limit exceeded',
        429,
        'RATE_LIMIT_EXCEEDED',
        { current: 21, max: 20 }
      );

      mockPrimaryLimiter.checkRateLimit.mockRejectedValue(rateLimitError);

      await expect(fallback.intelligentRateLimit('client1', 'uploads', mockPrimaryLimiter))
        .rejects
        .toThrow(AppError);
    });

    it('should fall back progressively on strategy failures', async () => {
      fallback.healthStatus.d1.status = 'healthy';
      fallback.healthStatus.kv.status = 'healthy';

      // Primary fails
      mockPrimaryLimiter.checkRateLimit.mockRejectedValue(new Error('Primary failed'));

      // D1 succeeds on fallback
      mockPrimaryLimiter.d1Limiter.checkRateLimit.mockResolvedValue({
        rateLimited: false,
        current: 1,
        max: 20
      });

      const result = await fallback.intelligentRateLimit('client1', 'uploads', mockPrimaryLimiter);

      expect(result.rateLimited).toBe(false);
      expect(mockPrimaryLimiter.d1Limiter.checkRateLimit).toHaveBeenCalled();
    });
  });

  describe('System Status', () => {
    it('should return comprehensive system status', async () => {
      const status = await fallback.getSystemStatus();

      expect(status.currentStrategy).toBeDefined();
      expect(status.components).toEqual(fallback.healthStatus);
      expect(status.availableComponents).toBeDefined();
      expect(status.memoryStore.entries).toBe(0);
      expect(status.timestamp).toBeDefined();
    });
  });

  describe('Memory Store Cleanup', () => {
    it('should remove expired entries', () => {
      const now = Date.now();

      // Add expired entry
      fallback.memoryStore.set('old:client', {
        lastUpdate: (now / 1000) - 1000 // 1000 seconds ago
      });

      // Add fresh entry
      fallback.memoryStore.set('new:client', {
        lastUpdate: (now / 1000) - 100 // 100 seconds ago
      });

      const result = fallback.cleanupMemoryStore();

      expect(result.removedExpired).toBe(1);
      expect(fallback.memoryStore.has('old:client')).toBe(false);
      expect(fallback.memoryStore.has('new:client')).toBe(true);
    });

    it('should limit memory store size', () => {
      // Fill beyond maxEntries
      for (let i = 0; i < 10005; i++) {
        fallback.memoryStore.set(`client${i}`, {
          lastUpdate: Math.floor(Date.now() / 1000)
        });
      }

      const result = fallback.cleanupMemoryStore();

      expect(fallback.memoryStore.size).toBeLessThanOrEqual(fallback.memoryConfig.maxEntries);
    });
  });

  describe('Force Recovery', () => {
    it('should force component recovery', async () => {
      // Set component as unhealthy
      fallback.healthStatus.d1.status = 'unhealthy';
      fallback.healthStatus.d1.failures = 5;
      fallback.healthStatus.d1.circuitBreakerUntil = Date.now() + 60000;

      const result = await fallback.forceRecovery('d1');

      expect(result.success).toBe(true);
      expect(fallback.healthStatus.d1.status).toBe('healthy');
      expect(fallback.healthStatus.d1.failures).toBe(0);
      expect(fallback.healthStatus.d1.circuitBreakerUntil).toBe(0);
    });

    it('should handle invalid component names', async () => {
      const result = await fallback.forceRecovery('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Component not found');
    });
  });

  describe('Maintenance', () => {
    it('should perform comprehensive maintenance', async () => {
      // Add some expired entries
      fallback.memoryStore.set('expired', {
        lastUpdate: Math.floor(Date.now() / 1000) - 2000
      });

      const result = await fallback.performMaintenance();

      expect(result.memoryCleanup.removedExpired).toBeGreaterThan(0);
      expect(result.healthStatus).toEqual(fallback.healthStatus);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Circuit Breaker', () => {
    it('should respect circuit breaker timeouts', () => {
      const now = Date.now();

      // Set circuit breaker for future
      fallback.healthStatus.d1.circuitBreakerUntil = now + 30000;
      fallback.healthStatus.d1.status = 'unhealthy';

      expect(fallback.isComponentAvailable('d1', now)).toBe(false);
      expect(fallback.isComponentAvailable('d1', now + 31000)).toBe(true);
    });
  });
});