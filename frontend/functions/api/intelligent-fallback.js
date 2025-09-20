/**
 * Intelligent Fallback Strategy
 * Provides graceful degradation and automatic recovery
 * when rate limiting components fail
 */

import { AppError } from './error-handler.js';

export class IntelligentFallback {
  constructor(env) {
    this.env = env;
    this.healthStatus = {
      d1: { status: 'healthy', lastCheck: 0, failures: 0 },
      kv: { status: 'healthy', lastCheck: 0, failures: 0 },
      r2: { status: 'healthy', lastCheck: 0, failures: 0 }
    };

    this.fallbackConfig = {
      healthCheckInterval: 30000, // 30 seconds
      failureThreshold: 3,
      recoveryThreshold: 2,
      circuitBreakerTimeout: 60000, // 1 minute
      defaultLimits: {
        uploads: { max: 20, window: 300 },
        conversions: { max: 10, window: 3600 },
        validations: { max: 30, window: 300 },
        downloads: { max: 50, window: 300 },
        suspicious: { max: 100, window: 60 }
      }
    };

    // In-memory fallback store
    this.memoryStore = new Map();
    this.memoryConfig = {
      maxEntries: 10000,
      cleanupInterval: 300000, // 5 minutes
      entryTtl: 900000 // 15 minutes
    };
  }

  /**
   * Health check for all components
   */
  async checkHealth() {
    const now = Date.now();
    const promises = [];

    // Check D1 health
    if (now - this.healthStatus.d1.lastCheck > this.fallbackConfig.healthCheckInterval) {
      promises.push(this.checkD1Health());
    }

    // Check KV health
    if (now - this.healthStatus.kv.lastCheck > this.fallbackConfig.healthCheckInterval) {
      promises.push(this.checkKVHealth());
    }

    // Check R2 health
    if (now - this.healthStatus.r2.lastCheck > this.fallbackConfig.healthCheckInterval) {
      promises.push(this.checkR2Health());
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    return this.healthStatus;
  }

  /**
   * Check D1 database health
   */
  async checkD1Health() {
    try {
      const start = Date.now();
      await this.env.RATE_LIMITS_DB.prepare('SELECT 1').run();
      const latency = Date.now() - start;

      this.updateHealthStatus('d1', true, latency);
    } catch (error) {
      this.updateHealthStatus('d1', false, 0, error);
    }
  }

  /**
   * Check KV storage health
   */
  async checkKVHealth() {
    try {
      const start = Date.now();
      const testKey = `health_check_${Date.now()}`;
      await this.env.RATE_LIMITS.put(testKey, 'test', { expirationTtl: 60 });
      await this.env.RATE_LIMITS.get(testKey);
      await this.env.RATE_LIMITS.delete(testKey);
      const latency = Date.now() - start;

      this.updateHealthStatus('kv', true, latency);
    } catch (error) {
      this.updateHealthStatus('kv', false, 0, error);
    }
  }

  /**
   * Check R2 storage health
   */
  async checkR2Health() {
    try {
      const start = Date.now();
      const testKey = `health_check_${Date.now()}.txt`;
      await this.env.FILE_STORAGE.put(testKey, 'test');
      await this.env.FILE_STORAGE.get(testKey);
      await this.env.FILE_STORAGE.delete(testKey);
      const latency = Date.now() - start;

      this.updateHealthStatus('r2', true, latency);
    } catch (error) {
      this.updateHealthStatus('r2', false, 0, error);
    }
  }

  /**
   * Update health status for a component
   */
  updateHealthStatus(component, success, latency, error = null) {
    const status = this.healthStatus[component];
    status.lastCheck = Date.now();
    status.latency = latency;

    if (success) {
      status.failures = Math.max(0, status.failures - 1);
      if (status.failures <= this.fallbackConfig.recoveryThreshold) {
        status.status = 'healthy';
        status.circuitBreakerUntil = 0;
      }
    } else {
      status.failures++;
      status.lastError = error?.message || 'Unknown error';

      if (status.failures >= this.fallbackConfig.failureThreshold) {
        status.status = 'unhealthy';
        status.circuitBreakerUntil = Date.now() + this.fallbackConfig.circuitBreakerTimeout;
      } else {
        status.status = 'degraded';
      }

      console.error(`Component ${component} health check failed:`, error);
    }
  }

  /**
   * Get available components for rate limiting
   */
  getAvailableComponents() {
    const now = Date.now();
    const available = {
      d1: this.isComponentAvailable('d1', now),
      kv: this.isComponentAvailable('kv', now),
      r2: this.isComponentAvailable('r2', now)
    };

    // Determine fallback strategy
    if (available.d1 && available.kv) {
      return { strategy: 'full', components: available };
    } else if (available.d1) {
      return { strategy: 'd1-only', components: available };
    } else if (available.kv) {
      return { strategy: 'kv-only', components: available };
    } else {
      return { strategy: 'memory-only', components: available };
    }
  }

  /**
   * Check if component is available
   */
  isComponentAvailable(component, now = Date.now()) {
    const status = this.healthStatus[component];
    return status.status === 'healthy' ||
           (status.status === 'unhealthy' && now > status.circuitBreakerUntil);
  }

  /**
   * Fallback rate limit check using memory store
   */
  async memoryRateLimit(clientId, endpoint, config) {
    const key = `${clientId}:${endpoint}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    // Get or create bucket
    let bucket = this.memoryStore.get(key);
    if (!bucket) {
      bucket = { requests: [], lastUpdate: now };
      this.memoryStore.set(key, bucket);
    }

    // Clean expired requests
    bucket.requests = bucket.requests.filter(timestamp => timestamp > windowStart);

    // Check limit
    if (bucket.requests.length >= config.max) {
      const resetTime = bucket.requests[0] + config.window;
      throw new AppError(
        'RATE_LIMIT_EXCEEDED',
        {
          current: bucket.requests.length,
          max: config.max,
          resetTime,
          retryAfter: Math.max(0, resetTime - now),
          source: 'memory-fallback'
        },
        429
      );
    }

    // Add current request
    bucket.requests.push(now);
    bucket.lastUpdate = now;

    return {
      rateLimited: false,
      current: bucket.requests.length,
      max: config.max,
      source: 'memory-fallback'
    };
  }

  /**
   * Fallback rate limit check using KV only
   */
  async kvOnlyRateLimit(clientId, endpoint, config) {
    const key = `fallback:${clientId}:${endpoint}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    try {
      // Get current data
      const data = await this.env.RATE_LIMITS.get(key, 'json') || { requests: [] };

      // Clean expired requests
      data.requests = data.requests.filter(timestamp => timestamp > windowStart);

      // Check limit
      if (data.requests.length >= config.max) {
        const resetTime = data.requests[0] + config.window;
        throw new AppError(
          'RATE_LIMIT_EXCEEDED',
          {
            current: data.requests.length,
            max: config.max,
            resetTime,
            retryAfter: Math.max(0, resetTime - now),
            source: 'kv-fallback'
          },
          429
        );
      }

      // Add current request and save
      data.requests.push(now);
      await this.env.RATE_LIMITS.put(key, JSON.stringify(data), {
        expirationTtl: config.window + 60
      });

      return {
        rateLimited: false,
        current: data.requests.length,
        max: config.max,
        source: 'kv-fallback'
      };
    } catch (error) {
      console.error('KV fallback failed:', error);
      // Fall back to memory
      return this.memoryRateLimit(clientId, endpoint, config);
    }
  }

  /**
   * Get configuration with fallbacks
   */
  getConfig(endpoint) {
    return this.fallbackConfig.defaultLimits[endpoint] || {
      max: 10,
      window: 300
    };
  }

  /**
   * Intelligent rate limit with automatic fallback
   */
  async intelligentRateLimit(clientId, endpoint, primaryLimiter) {
    await this.checkHealth();
    const { strategy, components } = this.getAvailableComponents();
    const config = this.getConfig(endpoint);

    console.log(`Rate limit strategy: ${strategy}, endpoint: ${endpoint}, client: ${clientId}`);

    try {
      switch (strategy) {
        case 'full':
          // Use primary multi-tier limiter
          return await primaryLimiter.checkRateLimit(clientId, endpoint);

        case 'd1-only':
          // Use D1 directly without KV caching
          return await primaryLimiter.d1Limiter.checkRateLimit(clientId, endpoint);

        case 'kv-only':
          // Use KV-only fallback
          return await this.kvOnlyRateLimit(clientId, endpoint, config);

        case 'memory-only':
          // Use in-memory fallback
          return await this.memoryRateLimit(clientId, endpoint, config);

        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
    } catch (error) {
      if (error instanceof AppError && error.code === 'RATE_LIMIT_EXCEEDED') {
        throw error;
      }

      console.error(`Rate limit strategy ${strategy} failed, falling back:`, error);

      // Progressive fallback
      if (strategy === 'full' && components.d1) {
        return await primaryLimiter.d1Limiter.checkRateLimit(clientId, endpoint);
      } else if ((strategy === 'full' || strategy === 'd1-only') && components.kv) {
        return await this.kvOnlyRateLimit(clientId, endpoint, config);
      } else {
        return await this.memoryRateLimit(clientId, endpoint, config);
      }
    }
  }

  /**
   * Get system status including fallback information
   */
  async getSystemStatus() {
    await this.checkHealth();

    const { strategy, components } = this.getAvailableComponents();

    return {
      currentStrategy: strategy,
      components: this.healthStatus,
      availableComponents: components,
      memoryStore: {
        entries: this.memoryStore.size,
        maxEntries: this.memoryConfig.maxEntries
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup memory store
   */
  cleanupMemoryStore() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, bucket] of this.memoryStore.entries()) {
      const age = (now / 1000) - bucket.lastUpdate;
      if (age > this.memoryConfig.entryTtl / 1000) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.memoryStore.delete(key));

    // If still too many entries, remove oldest
    if (this.memoryStore.size > this.memoryConfig.maxEntries) {
      const entries = Array.from(this.memoryStore.entries())
        .sort((a, b) => a[1].lastUpdate - b[1].lastUpdate);

      const toRemove = entries.slice(0, this.memoryStore.size - this.memoryConfig.maxEntries);
      toRemove.forEach(([key]) => this.memoryStore.delete(key));
    }

    return {
      removedExpired: expiredKeys.length,
      currentSize: this.memoryStore.size
    };
  }

  /**
   * Force recovery of a component
   */
  async forceRecovery(component) {
    if (this.healthStatus[component]) {
      this.healthStatus[component].failures = 0;
      this.healthStatus[component].status = 'healthy';
      this.healthStatus[component].circuitBreakerUntil = 0;
      this.healthStatus[component].lastCheck = 0; // Force recheck

      console.log(`Forced recovery of component: ${component}`);
      return { success: true, component };
    }

    return { success: false, error: 'Component not found' };
  }

  /**
   * Periodic maintenance
   */
  async performMaintenance() {
    const cleanupResult = this.cleanupMemoryStore();
    await this.checkHealth();

    return {
      memoryCleanup: cleanupResult,
      healthStatus: this.healthStatus,
      timestamp: new Date().toISOString()
    };
  }
}