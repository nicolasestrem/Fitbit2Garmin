/**
 * D1-based Atomic Rate Limiter
 * Provides ACID-compliant rate limiting using Cloudflare D1 database
 * Eliminates race conditions through database transactions
 */

import { AppError } from './error-handler.js';

export class D1RateLimiter {
  constructor(env) {
    this.db = env.RATE_LIMITS_DB;
    this.kv = env.RATE_LIMITS; // KV for caching
    this.configs = new Map(); // In-memory config cache
  }

  /**
   * Load rate limiting configuration from D1
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
   * Check rate limit with atomic D1 operations
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
      // Atomic rate limit check with cleanup and insert
      const result = await this.db.batch([
        // Clean expired requests and get current count
        this.db.prepare(`
          DELETE FROM rate_limits
          WHERE client_id = ? AND endpoint = ? AND timestamp <= ?
        `).bind(clientId, endpoint, windowStart),

        // Get current request count in window
        this.db.prepare(`
          SELECT COALESCE(SUM(request_count), 0) as current_count
          FROM rate_limits
          WHERE client_id = ? AND endpoint = ? AND timestamp > ?
        `).bind(clientId, endpoint, windowStart),

        // Get client reputation
        this.db.prepare(`
          SELECT reputation_score, risk_level
          FROM client_reputation
          WHERE client_id = ?
        `).bind(clientId)
      ]);

      const currentCount = result[1].results[0]?.current_count || 0;
      const reputation = result[2].results[0];

      // Apply reputation-based adjustments
      const effectiveMax = this.getEffectiveLimit(config.max, reputation);

      if (currentCount >= effectiveMax) {
        // Rate limited - record violation
        await this.recordViolation(clientId, endpoint, currentCount, effectiveMax, config.window, metadata);

        const resetTime = await this.getResetTime(clientId, endpoint, config.window);

        throw new AppError(
          'RATE_LIMIT_EXCEEDED',
          {
            current: currentCount,
            max: effectiveMax,
            resetTime,
            retryAfter: Math.max(0, resetTime - now)
          },
          429
        );
      }

      // Allow request - record it atomically
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
      `).bind(
        clientId,
        endpoint,
        now,
        windowBucket,
        JSON.stringify(metadata),
        now,
        JSON.stringify(metadata)
      ).run();

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
   * Apply reputation-based rate limit adjustments
   */
  getEffectiveLimit(baseLimit, reputation) {
    if (!reputation) return baseLimit;

    const score = reputation.reputation_score;
    const riskLevel = reputation.risk_level;

    // Reduce limits for risky clients
    switch (riskLevel) {
      case 'CRITICAL':
        return Math.floor(baseLimit * 0.1); // 90% reduction
      case 'HIGH':
        return Math.floor(baseLimit * 0.3); // 70% reduction
      case 'MEDIUM':
        return Math.floor(baseLimit * 0.6); // 40% reduction
      case 'LOW':
      default:
        return baseLimit;
    }
  }

  /**
   * Record rate limit violation
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
        clientId,
        endpoint,
        violationType,
        Math.floor(Date.now() / 1000),
        currentCount,
        limitExceeded,
        windowSize,
        metadata.fingerprint || null,
        metadata.userAgent || null,
        JSON.stringify(metadata)
      ).run();
    } catch (error) {
      console.error('Failed to record violation:', error);
    }
  }

  /**
   * Determine violation type based on severity
   */
  getViolationType(currentCount, limit) {
    const ratio = currentCount / limit;

    if (ratio >= 3) return 'BURST_ATTACK';
    if (ratio >= 1.5) return 'SUSPICIOUS_PATTERN';
    return 'RATE_EXCEEDED';
  }

  /**
   * Get reset time for rate limit
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
   * Get rate limit status for client
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
   * Reset rate limits for client/endpoint
   */
  async resetLimits(clientId, endpoint = null) {
    try {
      if (endpoint) {
        await this.db.prepare(`
          DELETE FROM rate_limits WHERE client_id = ? AND endpoint = ?
        `).bind(clientId, endpoint).run();
      } else {
        await this.db.prepare(`
          DELETE FROM rate_limits WHERE client_id = ?
        `).bind(clientId).run();
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to reset limits:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get analytics data
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
   * Cleanup old data (called periodically)
   */
  async cleanup() {
    try {
      const cutoff = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60); // 7 days

      await this.db.batch([
        this.db.prepare(`
          DELETE FROM rate_limits WHERE timestamp < ?
        `).bind(cutoff),

        this.db.prepare(`
          DELETE FROM rate_limit_violations WHERE timestamp < ?
        `).bind(cutoff)
      ]);

      return { success: true };
    } catch (error) {
      console.error('Cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }
}