/**
 * Multi-Tier Rate Limiting Architecture
 * Combines D1 (atomic), KV (cache), and R2 (analytics) for optimal performance
 *
 * Tier 1: KV Cache - Fast lookups for recent rate limit checks
 * Tier 2: D1 Database - Atomic operations and authoritative source
 * Tier 3: R2 Storage - Long-term analytics and audit logs
 */

import { D1RateLimiter } from './d1-rate-limiter.js';
import { AppError } from './error-handler.js';

export class MultiTierRateLimiter {
  constructor(env) {
    this.d1Limiter = new D1RateLimiter(env);
    this.kv = env.RATE_LIMITS;
    this.r2 = env.FILE_STORAGE;

    // Cache configuration
    this.cacheConfig = {
      ttl: 300, // 5 minutes
      prefix: 'rl:',
      statusPrefix: 'st:',
      reputationPrefix: 'rep:'
    };

    // R2 analytics configuration
    this.analyticsConfig = {
      batchSize: 100,
      flushInterval: 60000, // 1 minute
      buffer: []
    };
  }

  /**
   * Primary rate limit check with intelligent caching
   */
  async checkRateLimit(clientId, endpoint, metadata = {}) {
    const cacheKey = `${this.cacheConfig.prefix}${clientId}:${endpoint}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      // Tier 1: Check KV cache first for hot paths
      const cached = await this.getCachedResult(cacheKey, now);
      if (cached && cached.timestamp > now - 30) { // Use cache for 30 seconds
        if (cached.rateLimited) {
          throw new AppError(
            'Rate limit exceeded',
            429,
            'RATE_LIMIT_EXCEEDED',
            cached.details
          );
        }

        // Fast path: update cache and return
        await this.updateCache(cacheKey, {
          ...cached,
          current: cached.current + 1,
          timestamp: now
        });

        return {
          rateLimited: false,
          current: cached.current + 1,
          max: cached.max,
          source: 'cache'
        };
      }

      // Tier 2: Check D1 for authoritative decision
      const result = await this.d1Limiter.checkRateLimit(clientId, endpoint, metadata);

      // Cache the result for subsequent requests
      await this.updateCache(cacheKey, {
        rateLimited: result.rateLimited,
        current: result.current,
        max: result.max,
        timestamp: now,
        details: result.rateLimited ? {
          resetTime: result.resetTime,
          retryAfter: result.retryAfter
        } : null
      });

      // Tier 3: Queue for R2 analytics (async)
      this.queueAnalytics(clientId, endpoint, result, metadata);

      return { ...result, source: 'd1' };

    } catch (error) {
      if (error instanceof AppError && error.code === 'RATE_LIMIT_EXCEEDED') {
        // Cache rate limit status to avoid repeated D1 calls
        await this.updateCache(cacheKey, {
          rateLimited: true,
          current: error.details.current,
          max: error.details.max,
          timestamp: now,
          details: error.details
        });

        this.queueAnalytics(clientId, endpoint, {
          rateLimited: true,
          ...error.details
        }, metadata);

        throw error;
      }

      console.error('Multi-tier rate limit check failed:', error);

      // Fallback: check cache for last known good state
      const fallback = await this.getCachedResult(cacheKey, now - 300); // 5 min grace
      if (fallback) {
        return {
          rateLimited: false,
          current: fallback.current + 1,
          max: fallback.max,
          source: 'fallback',
          warning: 'Using cached fallback data'
        };
      }

      // Final fallback: fail open
      return {
        rateLimited: false,
        current: 1,
        max: 1000,
        source: 'fail-open',
        error: error.message
      };
    }
  }

  /**
   * Get cached rate limit result
   */
  async getCachedResult(cacheKey, minTimestamp) {
    try {
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached && cached.timestamp >= minTimestamp) {
        return cached;
      }
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Update KV cache with rate limit data
   */
  async updateCache(cacheKey, data) {
    try {
      await this.kv.put(cacheKey, JSON.stringify(data), {
        expirationTtl: this.cacheConfig.ttl
      });
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Get comprehensive status from all tiers
   */
  async getStatus(clientId) {
    try {
      // Get fresh status from D1
      const d1Status = await this.d1Limiter.getStatus(clientId);

      // Get cached reputation
      const reputation = await this.getClientReputation(clientId);

      // Combine with cache hits/misses metrics
      const cacheStats = await this.getCacheStats(clientId);

      return {
        rateLimits: d1Status,
        reputation,
        cache: cacheStats,
        source: 'multi-tier'
      };
    } catch (error) {
      console.error('Failed to get multi-tier status:', error);
      return await this.d1Limiter.getStatus(clientId);
    }
  }

  /**
   * Get client reputation with caching
   */
  async getClientReputation(clientId) {
    const cacheKey = `${this.cacheConfig.reputationPrefix}${clientId}`;

    try {
      // Check cache first
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached && cached.timestamp > Date.now() - 60000) { // 1 minute cache
        return cached.data;
      }

      // Get from D1
      const { results } = await this.d1Limiter.db.prepare(`
        SELECT * FROM client_reputation WHERE client_id = ?
      `).bind(clientId).all();

      const reputation = results[0] || {
        client_id: clientId,
        reputation_score: 100,
        risk_level: 'LOW',
        total_requests: 0,
        violation_count: 0
      };

      // Cache the result
      await this.kv.put(cacheKey, JSON.stringify({
        data: reputation,
        timestamp: Date.now()
      }), { expirationTtl: 300 });

      return reputation;
    } catch (error) {
      console.error('Failed to get reputation:', error);
      return { reputation_score: 100, risk_level: 'LOW' };
    }
  }

  /**
   * Get cache statistics for client
   */
  async getCacheStats(clientId) {
    try {
      const endpoints = ['uploads', 'conversions', 'validations', 'downloads'];
      const stats = { hits: 0, misses: 0, total: 0 };

      for (const endpoint of endpoints) {
        const cacheKey = `${this.cacheConfig.prefix}${clientId}:${endpoint}`;
        const exists = await this.kv.get(cacheKey);

        if (exists) {
          stats.hits++;
        } else {
          stats.misses++;
        }
        stats.total++;
      }

      stats.hitRate = stats.total > 0 ? (stats.hits / stats.total) : 0;
      return stats;
    } catch (error) {
      return { hits: 0, misses: 0, total: 0, hitRate: 0 };
    }
  }

  /**
   * Queue analytics data for R2 storage
   */
  queueAnalytics(clientId, endpoint, result, metadata) {
    try {
      const event = {
        timestamp: new Date().toISOString(),
        clientId,
        endpoint,
        rateLimited: result.rateLimited,
        current: result.current,
        max: result.max,
        source: result.source || 'unknown',
        metadata: {
          userAgent: metadata.userAgent,
          fingerprint: metadata.fingerprint,
          country: metadata.country,
          ip: metadata.ip // Only hash, never store raw IPs
        }
      };

      this.analyticsConfig.buffer.push(event);

      // Flush to R2 if buffer is full
      if (this.analyticsConfig.buffer.length >= this.analyticsConfig.batchSize) {
        this.flushAnalytics();
      }
    } catch (error) {
      console.error('Analytics queue error:', error);
    }
  }

  /**
   * Flush analytics buffer to R2 storage
   */
  async flushAnalytics() {
    if (this.analyticsConfig.buffer.length === 0) return;

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours().toString().padStart(2, '0');
      const key = `analytics/rate-limits/${timestamp}/${hour}/${Date.now()}.json`;

      const data = {
        events: [...this.analyticsConfig.buffer],
        metadata: {
          count: this.analyticsConfig.buffer.length,
          timestamp: new Date().toISOString()
        }
      };

      await this.r2.put(key, JSON.stringify(data), {
        httpMetadata: {
          contentType: 'application/json'
        },
        customMetadata: {
          type: 'rate-limit-analytics',
          date: timestamp,
          hour: hour
        }
      });

      // Clear buffer
      this.analyticsConfig.buffer = [];

      console.log(`Flushed ${data.events.length} analytics events to R2: ${key}`);
    } catch (error) {
      console.error('Failed to flush analytics to R2:', error);
      // Don't clear buffer on error - retry next time
    }
  }

  /**
   * Reset limits across all tiers
   */
  async resetLimits(clientId, endpoint = null) {
    try {
      // Reset in D1
      const result = await this.d1Limiter.resetLimits(clientId, endpoint);

      // Clear relevant cache entries
      if (endpoint) {
        const cacheKey = `${this.cacheConfig.prefix}${clientId}:${endpoint}`;
        await this.kv.delete(cacheKey);
      } else {
        // Clear all endpoint caches for client
        const endpoints = ['uploads', 'conversions', 'validations', 'downloads'];
        await Promise.all(endpoints.map(ep =>
          this.kv.delete(`${this.cacheConfig.prefix}${clientId}:${ep}`)
        ));
      }

      // Clear reputation cache
      await this.kv.delete(`${this.cacheConfig.reputationPrefix}${clientId}`);

      return result;
    } catch (error) {
      console.error('Failed to reset multi-tier limits:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get analytics from R2 storage
   */
  async getAnalytics(timeframe = '24h') {
    try {
      // Try D1 first for recent data
      const d1Analytics = await this.d1Limiter.getAnalytics(timeframe);

      // Enhance with R2 data for trends
      const r2Analytics = await this.getR2Analytics(timeframe);

      return {
        ...d1Analytics,
        trends: r2Analytics,
        source: 'multi-tier'
      };
    } catch (error) {
      console.error('Failed to get multi-tier analytics:', error);
      return await this.d1Limiter.getAnalytics(timeframe);
    }
  }

  /**
   * Get analytics data from R2 storage
   */
  async getR2Analytics(timeframe) {
    try {
      const hours = timeframe === '7d' ? 168 : 24;
      const files = [];

      // List recent analytics files
      const prefix = 'analytics/rate-limits/';
      const objects = await this.r2.list({ prefix, limit: hours });

      for (const obj of objects.objects) {
        try {
          const data = await this.r2.get(obj.key);
          if (data) {
            const analytics = await data.json();
            files.push(analytics);
          }
        } catch (error) {
          console.error(`Failed to read analytics file ${obj.key}:`, error);
        }
      }

      return this.aggregateR2Analytics(files);
    } catch (error) {
      console.error('Failed to get R2 analytics:', error);
      return { totalEvents: 0, sources: {}, endpoints: {} };
    }
  }

  /**
   * Aggregate R2 analytics data
   */
  aggregateR2Analytics(files) {
    const summary = {
      totalEvents: 0,
      sources: {},
      endpoints: {},
      violations: 0
    };

    for (const file of files) {
      for (const event of file.events) {
        summary.totalEvents++;

        // Track sources (cache, d1, fallback)
        const source = event.source || 'unknown';
        summary.sources[source] = (summary.sources[source] || 0) + 1;

        // Track endpoints
        summary.endpoints[event.endpoint] = (summary.endpoints[event.endpoint] || 0) + 1;

        // Track violations
        if (event.rateLimited) {
          summary.violations++;
        }
      }
    }

    return summary;
  }

  /**
   * Periodic maintenance across all tiers
   */
  async performMaintenance() {
    try {
      const results = await Promise.allSettled([
        // D1 cleanup
        this.d1Limiter.cleanup(),

        // Flush pending analytics
        this.flushAnalytics(),

        // Clear expired cache entries (KV handles this automatically)
        // R2 cleanup (could implement lifecycle rules)
      ]);

      const summary = {
        d1Cleanup: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
        analyticsFlush: results[1].status === 'fulfilled' ? 'success' : results[1].reason,
        timestamp: new Date().toISOString()
      };

      console.log('Multi-tier maintenance completed:', summary);
      return summary;
    } catch (error) {
      console.error('Maintenance failed:', error);
      return { error: error.message };
    }
  }
}