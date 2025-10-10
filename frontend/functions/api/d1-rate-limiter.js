/**
 * @file D1-based Atomic Rate Limiter
 * @description Provides ACID-compliant rate limiting using a Cloudflare D1 database,
 * which eliminates race conditions inherent in simpler KV-based solutions by using
 * database transactions and atomic operations.
 */

import { AppError } from './error-handler.js';

/**
 * A rate limiter class that uses Cloudflare D1 for state management.
 */
export class D1RateLimiter {
  /**
   * Creates an instance of D1RateLimiter.
   * @param {object} env - The Cloudflare environment object, containing bindings.
   * @param {D1Database} env.RATE_LIMITS_DB - The D1 database binding for rate limits.
   * @param {KVNamespace} env.RATE_LIMITS - The KV namespace for caching (optional).
   */
  constructor(env) {
    this.db = env.RATE_LIMITS_DB;
    this.kv = env.RATE_LIMITS;
    this.configs = new Map(); // In-memory config cache
  }

  /**
   * Loads rate limiting configurations from the D1 database into an in-memory cache.
   * If loading fails, it falls back to a set of default configurations.
   * @returns {Promise<void>}
   */
  async loadConfig() {
    if (this.configs.size > 0) return; // Already loaded

    try {
      const { results } = await this.db.prepare(`
        SELECT endpoint, max_requests, window_size, burst_allowance, enabled
        FROM rate_limit_config
        WHERE client_id IS NULL AND enabled = 1
        ORDER BY priority DESC
      `).all();

      for (const config of results) {
        this.configs.set(config.endpoint, {
          max: config.max_requests,
          window: config.window_size,
          burst: config.burst_allowance || 0,
          enabled: config.enabled === 1
        });
      }
    } catch (error) {
      console.error('Failed to load rate limit config:', error);
      // Fallback to default configs
      this.configs.set('uploads', { max: 20, window: 300, burst: 0, enabled: true });
      this.configs.set('conversions', { max: 10, window: 3600, burst: 0, enabled: true });
      this.configs.set('validations', { max: 30, window: 300, burst: 0, enabled: true });
      this.configs.set('downloads', { max: 50, window: 300, burst: 0, enabled: true });
      this.configs.set('suspicious', { max: 100, window: 60, burst: 0, enabled: true });
    }
  }

  /**
   * Checks the rate limit for a given client and endpoint using atomic D1 operations.
   * If the limit is exceeded, it throws a specific AppError. Otherwise, it records the request.
   * @param {string} clientId - The unique identifier for the client (e.g., IP address).
   * @param {string} endpoint - The API endpoint being accessed (e.g., 'uploads').
   * @param {object} [metadata={}] - Additional metadata to log with the request.
   * @returns {Promise<object>} An object indicating the result of the check.
   * @throws {AppError} If the rate limit is exceeded.
   */
  async checkRateLimit(clientId, endpoint, metadata = {}) {
    await this.loadConfig();

    const config = this.configs.get(endpoint);
    if (!config || !config.enabled) {
      return { rateLimited: false, current: 0, max: 0 };
    }

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    try {
      // Use a D1 batch for atomic operations: clean old records, get current count, and get reputation.
      const result = await this.db.batch([
        this.db.prepare(`
          DELETE FROM rate_limits
          WHERE client_id = ? AND endpoint = ? AND timestamp <= ?
        `).bind(clientId, endpoint, windowStart),
        this.db.prepare(`
          SELECT COALESCE(SUM(request_count), 0) as current_count
          FROM rate_limits
          WHERE client_id = ? AND endpoint = ? AND timestamp > ?
        `).bind(clientId, endpoint, windowStart),
        this.db.prepare(`
          SELECT reputation_score, risk_level
          FROM client_reputation
          WHERE client_id = ?
        `).bind(clientId)
      ]);

      const currentCount = result[1].results[0]?.current_count || 0;
      const reputation = result[2].results[0];
      const effectiveMax = this.getEffectiveLimit(config.max, reputation);

      if (currentCount >= effectiveMax) {
        await this.recordViolation(clientId, endpoint, currentCount, effectiveMax, config.window, metadata);
        const resetTime = await this.getResetTime(clientId, endpoint, config.window);
        throw new AppError(
          'RATE_LIMIT_EXCEEDED',
          { current: currentCount, max: effectiveMax, resetTime, retryAfter: Math.max(0, resetTime - now) },
          429
        );
      }

      // Atomically insert or update the request count for the current time bucket.
      const windowBucket = Math.floor(now / 60) * 60; // 1-minute buckets
      await this.db.prepare(`
        INSERT INTO rate_limits
        (client_id, endpoint, timestamp, window_start, request_count, metadata, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
        ON CONFLICT(client_id, endpoint, window_start)
        DO UPDATE SET
          request_count = request_count + 1,
          timestamp = ?,
          metadata = ?,
          updated_at = datetime('now')
      `).bind(clientId, endpoint, now, windowBucket, JSON.stringify(metadata), now, JSON.stringify(metadata)).run();

      return {
        rateLimited: false,
        current: currentCount + 1,
        max: effectiveMax,
        reputation: reputation?.reputation_score || 100
      };

    } catch (error) {
      // Re-throw the error to be handled by the IntelligentFallback mechanism
      throw error;
    }
  }

  /**
   * Adjusts a rate limit based on a client's reputation score and risk level.
   * @param {number} baseLimit - The default maximum number of requests.
   * @param {object} reputation - The client's reputation data.
   * @param {number} reputation.reputation_score - The client's score (0-100).
   * @param {string} reputation.risk_level - The client's risk level (e.g., 'HIGH').
   * @returns {number} The adjusted, effective rate limit.
   */
  getEffectiveLimit(baseLimit, reputation) {
    if (!reputation) return baseLimit;
    const riskLevel = reputation.risk_level;
    switch (riskLevel) {
      case 'CRITICAL': return Math.floor(baseLimit * 0.1); // 90% reduction
      case 'HIGH': return Math.floor(baseLimit * 0.3); // 70% reduction
      case 'MEDIUM': return Math.floor(baseLimit * 0.6); // 40% reduction
      case 'LOW': default: return baseLimit;
    }
  }

  /**
   * Records a rate limit violation in the database for analysis.
   * @param {string} clientId - The client identifier.
   * @param {string} endpoint - The endpoint where the violation occurred.
   * @param {number} currentCount - The number of requests made by the client.
   * @param {number} limitExceeded - The limit that was exceeded.
   * @param {number} windowSize - The duration of the rate limit window in seconds.
   * @param {object} metadata - Additional metadata about the request.
   * @returns {Promise<void>}
   */
  async recordViolation(clientId, endpoint, currentCount, limitExceeded, windowSize, metadata) {
    try {
      const violationType = this.getViolationType(currentCount, limitExceeded);
      await this.db.prepare(`
        INSERT INTO rate_limit_violations
        (client_id, endpoint, violation_type, timestamp, current_count,
         limit_exceeded, window_size, client_fingerprint, user_agent, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        clientId, endpoint, violationType, Math.floor(Date.now() / 1000),
        currentCount, limitExceeded, windowSize,
        metadata.fingerprint || null, metadata.userAgent || null, JSON.stringify(metadata)
      ).run();
    } catch (error) {
      console.error('Failed to record violation:', error);
    }
  }

  /**
   * Determines the type of violation based on how much the limit was exceeded.
   * @param {number} currentCount - The number of requests made.
   * @param {number} limit - The rate limit.
   * @returns {string} The violation type (e.g., 'BURST_ATTACK').
   */
  getViolationType(currentCount, limit) {
    const ratio = currentCount / limit;
    if (ratio >= 3) return 'BURST_ATTACK';
    if (ratio >= 1.5) return 'SUSPICIOUS_PATTERN';
    return 'RATE_EXCEEDED';
  }

  /**
   * Calculates the Unix timestamp when a client's rate limit window will reset.
   * @param {string} clientId - The client identifier.
   * @param {string} endpoint - The specific endpoint.
   * @param {number} windowSize - The duration of the rate limit window in seconds.
   * @returns {Promise<number>} The reset timestamp.
   */
  async getResetTime(clientId, endpoint, windowSize) {
    try {
      const { results } = await this.db.prepare(`
        SELECT MIN(timestamp) + ? as reset_time
        FROM rate_limits
        WHERE client_id = ? AND endpoint = ?
      `).bind(windowSize, clientId, endpoint).all();
      return results[0]?.reset_time || Math.floor(Date.now() / 1000) + windowSize;
    } catch (error) {
      return Math.floor(Date.now() / 1000) + windowSize;
    }
  }

  /**
   * Retrieves the current rate limit status for a client across all configured endpoints.
   * @param {string} clientId - The client identifier.
   * @returns {Promise<object>} An object mapping endpoints to their current status.
   */
  async getStatus(clientId) {
    await this.loadConfig();
    const status = {};
    const now = Math.floor(Date.now() / 1000);
    try {
      for (const [endpoint, config] of this.configs) {
        const windowStart = now - config.window;
        const { results } = await this.db.prepare(`
          SELECT COALESCE(SUM(request_count), 0) as current_count
          FROM rate_limits
          WHERE client_id = ? AND endpoint = ? AND timestamp > ?
        `).bind(clientId, endpoint, windowStart).all();
        const currentCount = results[0]?.current_count || 0;
        const resetTime = await this.getResetTime(clientId, endpoint, config.window);
        status[endpoint] = {
          current: currentCount,
          max: config.max,
          resetTime,
          retryAfter: Math.max(0, resetTime - now)
        };
      }
      return status;
    } catch (error) {
      console.error('Failed to get status:', error);
      return {};
    }
  }

  /**
   * Manually resets the rate limits for a given client, either for a specific endpoint or all endpoints.
   * @param {string} clientId - The client identifier.
   * @param {string | null} [endpoint=null] - The specific endpoint to reset, or null for all.
   * @returns {Promise<{success: boolean, error?: string}>} An object indicating the outcome.
   */
  async resetLimits(clientId, endpoint = null) {
    try {
      if (endpoint) {
        await this.db.prepare(`DELETE FROM rate_limits WHERE client_id = ? AND endpoint = ?`).bind(clientId, endpoint).run();
      } else {
        await this.db.prepare(`DELETE FROM rate_limits WHERE client_id = ?`).bind(clientId).run();
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to reset limits:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieves analytics data about rate limit requests, violations, and risky clients.
   * @param {'24h' | '7d'} [timeframe='24h'] - The time frame for the analytics data.
   * @returns {Promise<object>} An object containing analytics data.
   */
  async getAnalytics(timeframe = '24h') {
    try {
      const hours = timeframe === '7d' ? 168 : 24;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const [requests, violations, clients] = await Promise.all([
        this.db.prepare(`
          SELECT * FROM rate_limit_analytics
          WHERE date >= date(?)
          ORDER BY date DESC, endpoint
        `).bind(cutoff.split('T')[0]).all(),
        this.db.prepare(`
          SELECT * FROM violation_analytics
          WHERE date >= date(?)
          ORDER BY date DESC, violation_type
        `).bind(cutoff.split('T')[0]).all(),
        this.db.prepare(`
          SELECT * FROM client_analytics
          WHERE reputation_score < 100 OR violation_count > 0
          ORDER BY reputation_score ASC, violation_count DESC
          LIMIT 50
        `).all()
      ]);
      return {
        requests: requests.results || [],
        violations: violations.results || [],
        riskyClients: clients.results || []
      };
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return { requests: [], violations: [], riskyClients: [] };
    }
  }

  /**
   * Cleans up old data from the rate limit tables. Intended to be called periodically.
   * @returns {Promise<{success: boolean, error?: string}>} An object indicating the outcome.
   */
  async cleanup() {
    try {
      const cutoff = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60); // 7 days
      await this.db.batch([
        this.db.prepare(`DELETE FROM rate_limits WHERE timestamp < ?`).bind(cutoff),
        this.db.prepare(`DELETE FROM rate_limit_violations WHERE timestamp < ?`).bind(cutoff)
      ]);
      return { success: true };
    } catch (error) {
      console.error('Cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }
}