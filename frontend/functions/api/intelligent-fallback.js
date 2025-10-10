/**
 * @file Intelligent Fallback Strategy
 * @description Provides a system for graceful degradation and automatic recovery
 * when backend components like D1, KV, or R2 fail. It implements a circuit breaker
 * pattern and falls back to less-dependent or in-memory solutions.
 */

import { AppError } from './error-handler.js';

/**
 * Manages the health of backend components and provides fallback mechanisms.
 */
export class IntelligentFallback {
  /**
   * Creates an instance of IntelligentFallback.
   * @param {object} env - The Cloudflare environment object.
   */
  constructor(env) {
    this.env = env;
    /** @type {object} - The health status of each backend component. */
    this.healthStatus = {
      d1: { status: 'healthy', lastCheck: 0, failures: 0 },
      kv: { status: 'healthy', lastCheck: 0, failures: 0 },
      r2: { status: 'healthy', lastCheck: 0, failures: 0 }
    };

    /** @type {object} - Configuration for fallback behavior. */
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

    /** @type {Map} - An in-memory store for the ultimate fallback rate limiting. */
    this.memoryStore = new Map();
    this.memoryConfig = {
      maxEntries: 10000,
      cleanupInterval: 300000, // 5 minutes
      entryTtl: 900000 // 15 minutes
    };
  }

  /**
   * Performs a health check on all backend components (D1, KV, R2) if the
   * configured interval has passed.
   * @returns {Promise<object>} The current health status of all components.
   */
  async checkHealth() {
    const now = Date.now();
    const promises = [];

    if (now - this.healthStatus.d1.lastCheck > this.fallbackConfig.healthCheckInterval) {
      promises.push(this.checkD1Health());
    }
    if (now - this.healthStatus.kv.lastCheck > this.fallbackConfig.healthCheckInterval) {
      promises.push(this.checkKVHealth());
    }
    if (now - this.healthStatus.r2.lastCheck > this.fallbackConfig.healthCheckInterval) {
      promises.push(this.checkR2Health());
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
    return this.healthStatus;
  }

  /**
   * Checks the health of the D1 database by performing a simple query.
   * @private
   */
  async checkD1Health() {
    try {
      const start = Date.now();
      await this.env.RATE_LIMITS_DB.prepare('SELECT 1').run();
      this.updateHealthStatus('d1', true, Date.now() - start);
    } catch (error) {
      this.updateHealthStatus('d1', false, 0, error);
    }
  }

  /**
   * Checks the health of the KV namespace by performing a write/read/delete cycle.
   * @private
   */
  async checkKVHealth() {
    try {
      const start = Date.now();
      const testKey = `health_check_${Date.now()}`;
      await this.env.RATE_LIMITS.put(testKey, 'test', { expirationTtl: 60 });
      await this.env.RATE_LIMITS.get(testKey);
      await this.env.RATE_LIMITS.delete(testKey);
      this.updateHealthStatus('kv', true, Date.now() - start);
    } catch (error) {
      this.updateHealthStatus('kv', false, 0, error);
    }
  }

  /**
   * Checks the health of the R2 bucket by performing a write/read/delete cycle.
   * @private
   */
  async checkR2Health() {
    try {
      const start = Date.now();
      const testKey = `health_check_${Date.now()}.txt`;
      await this.env.FILE_STORAGE.put(testKey, 'test');
      await this.env.FILE_STORAGE.get(testKey);
      await this.env.FILE_STORAGE.delete(testKey);
      this.updateHealthStatus('r2', true, Date.now() - start);
    } catch (error) {
      this.updateHealthStatus('r2', false, 0, error);
    }
  }

  /**
   * Updates the health status of a component based on a check's outcome.
   * Implements circuit breaker logic.
   * @param {string} component - The name of the component ('d1', 'kv', 'r2').
   * @param {boolean} success - Whether the health check was successful.
   * @param {number} latency - The latency of the health check operation.
   * @param {Error|null} [error=null] - The error object if the check failed.
   * @private
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
   * Determines the current operational strategy based on component health.
   * @returns {{strategy: string, components: object}} The current fallback strategy and component availability.
   */
  getAvailableComponents() {
    const now = Date.now();
    const available = {
      d1: this.isComponentAvailable('d1', now),
      kv: this.isComponentAvailable('kv', now),
      r2: this.isComponentAvailable('r2', now)
    };

    if (available.d1 && available.kv) return { strategy: 'full', components: available };
    if (available.d1) return { strategy: 'd1-only', components: available };
    if (available.kv) return { strategy: 'kv-only', components: available };
    return { strategy: 'memory-only', components: available };
  }

  /**
   * Checks if a specific component is currently available (not in a 'circuit open' state).
   * @param {string} component - The name of the component.
   * @param {number} [now=Date.now()] - The current timestamp.
   * @returns {boolean} True if the component is available, false otherwise.
   */
  isComponentAvailable(component, now = Date.now()) {
    const status = this.healthStatus[component];
    return status.status === 'healthy' || (status.status === 'unhealthy' && now > status.circuitBreakerUntil);
  }

  /**
   * A fallback rate limiter that uses an in-memory Map.
   * @param {string} clientId - The client identifier.
   * @param {string} endpoint - The endpoint being accessed.
   * @param {object} config - The rate limit configuration for the endpoint.
   * @returns {Promise<object>} The result of the rate limit check.
   */
  async memoryRateLimit(clientId, endpoint, config) {
    const key = `${clientId}:${endpoint}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;
    let bucket = this.memoryStore.get(key);
    if (!bucket) {
      bucket = { requests: [], lastUpdate: now };
      this.memoryStore.set(key, bucket);
    }

    bucket.requests = bucket.requests.filter(timestamp => timestamp > windowStart);

    if (bucket.requests.length >= config.max) {
      const resetTime = bucket.requests[0] + config.window;
      throw new AppError('RATE_LIMIT_EXCEEDED', {
        current: bucket.requests.length, max: config.max, resetTime,
        retryAfter: Math.max(0, resetTime - now), source: 'memory-fallback'
      }, 429);
    }

    bucket.requests.push(now);
    bucket.lastUpdate = now;
    return { rateLimited: false, current: bucket.requests.length, max: config.max, source: 'memory-fallback' };
  }

  /**
   * A fallback rate limiter that uses only KV storage.
   * @param {string} clientId - The client identifier.
   * @param {string} endpoint - The endpoint being accessed.
   * @param {object} config - The rate limit configuration for the endpoint.
   * @returns {Promise<object>} The result of the rate limit check.
   */
  async kvOnlyRateLimit(clientId, endpoint, config) {
    const key = `fallback:${clientId}:${endpoint}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    try {
      const data = await this.env.RATE_LIMITS.get(key, 'json') || { requests: [] };
      data.requests = data.requests.filter(timestamp => timestamp > windowStart);

      if (data.requests.length >= config.max) {
        const resetTime = data.requests[0] + config.window;
        throw new AppError('RATE_LIMIT_EXCEEDED', {
          current: data.requests.length, max: config.max, resetTime,
          retryAfter: Math.max(0, resetTime - now), source: 'kv-fallback'
        }, 429);
      }

      data.requests.push(now);
      await this.env.RATE_LIMITS.put(key, JSON.stringify(data), { expirationTtl: config.window + 60 });
      return { rateLimited: false, current: data.requests.length, max: config.max, source: 'kv-fallback' };
    } catch (error) {
      console.error('KV fallback failed:', error);
      return this.memoryRateLimit(clientId, endpoint, config);
    }
  }

  /**
   * Gets the default rate limit configuration for an endpoint.
   * @param {string} endpoint - The name of the endpoint.
   * @returns {object} The default configuration.
   */
  getConfig(endpoint) {
    return this.fallbackConfig.defaultLimits[endpoint] || { max: 10, window: 300 };
  }

  /**
   * Performs a rate limit check using the most robust available strategy.
   * It automatically falls back to simpler strategies if the primary ones fail.
   * @param {string} clientId - The client identifier.
   * @param {string} endpoint - The endpoint being accessed.
   * @param {object} primaryLimiter - The primary rate limiter instance to use when healthy.
   * @returns {Promise<object>} The result of the rate limit check.
   */
  async intelligentRateLimit(clientId, endpoint, primaryLimiter) {
    await this.checkHealth();
    const { strategy, components } = this.getAvailableComponents();
    const config = this.getConfig(endpoint);
    console.log(`Rate limit strategy: ${strategy}, endpoint: ${endpoint}, client: ${clientId}`);

    try {
      switch (strategy) {
        case 'full': return await primaryLimiter.checkRateLimit(clientId, endpoint);
        case 'd1-only': return await primaryLimiter.d1Limiter.checkRateLimit(clientId, endpoint);
        case 'kv-only': return await this.kvOnlyRateLimit(clientId, endpoint, config);
        case 'memory-only': return await this.memoryRateLimit(clientId, endpoint, config);
        default: throw new Error(`Unknown strategy: ${strategy}`);
      }
    } catch (error) {
      if (error instanceof AppError && error.code === 'RATE_LIMIT_EXCEEDED') {
        throw error;
      }
      console.error(`Rate limit strategy ${strategy} failed, falling back:`, error);
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
   * Gets a snapshot of the system's current health and fallback status.
   * @returns {Promise<object>} An object containing the system status.
   */
  async getSystemStatus() {
    await this.checkHealth();
    const { strategy, components } = this.getAvailableComponents();
    return {
      currentStrategy: strategy,
      components: this.healthStatus,
      availableComponents: components,
      memoryStore: { entries: this.memoryStore.size, maxEntries: this.memoryConfig.maxEntries },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleans up the in-memory store by removing expired or excess entries.
   * @returns {{removedExpired: number, currentSize: number}} The result of the cleanup operation.
   */
  cleanupMemoryStore() {
    const now = Date.now();
    const expiredKeys = [];
    for (const [key, bucket] of this.memoryStore.entries()) {
      if ((now / 1000) - bucket.lastUpdate > this.memoryConfig.entryTtl / 1000) {
        expiredKeys.push(key);
      }
    }
    expiredKeys.forEach(key => this.memoryStore.delete(key));

    if (this.memoryStore.size > this.memoryConfig.maxEntries) {
      const entries = Array.from(this.memoryStore.entries()).sort((a, b) => a[1].lastUpdate - b[1].lastUpdate);
      const toRemove = entries.slice(0, this.memoryStore.size - this.memoryConfig.maxEntries);
      toRemove.forEach(([key]) => this.memoryStore.delete(key));
    }
    return { removedExpired: expiredKeys.length, currentSize: this.memoryStore.size };
  }

  /**
   * Manually forces a component to be marked as healthy, resetting its circuit breaker.
   * @param {string} component - The name of the component to recover.
   * @returns {Promise<{success: boolean, error?: string, component?: string}>} The result of the operation.
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
   * Performs periodic maintenance tasks, such as cleaning the memory store and running health checks.
   * @returns {Promise<object>} An object summarizing the maintenance tasks performed.
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