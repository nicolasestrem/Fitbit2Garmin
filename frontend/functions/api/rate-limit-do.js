/**
 * Durable Object for Atomic Rate Limiting
 *
 * Provides atomic rate limiting operations using Cloudflare Durable Objects
 * to eliminate race conditions and ensure accurate enforcement.
 */

import { AppError, ERROR_CODES } from './error-handler.js';

export class RateLimitDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // In-memory cache for rate limit buckets
    this.buckets = new Map();

    // Configuration for different endpoints
    this.configs = {
      uploads: { max: 20, window: 300 }, // 20 uploads per 5 minutes
      conversions: { max: 10, window: 3600 }, // 10 conversions per hour
      validations: { max: 30, window: 300 }, // 30 validations per 5 minutes
      suspicious: { max: 100, window: 60 } // 100 requests per minute for abuse detection
    };
  }

  /**
   * Handle rate limiting requests
   */
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const action = url.pathname.substring(1); // Remove leading slash

      switch (action) {
        case 'check':
          return await this.handleRateLimitCheck(request);
        case 'reset':
          return await this.handleReset(request);
        case 'status':
          return await this.handleStatus(request);
        default:
          return new Response('Invalid action', { status: 400 });
      }
    } catch (error) {
      console.error('RateLimitDO error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  /**
   * Check and update rate limit for a client
   */
  async handleRateLimitCheck(request) {
    const { clientId, endpoint, timestamp } = await request.json();

    if (!clientId || !endpoint) {
      return new Response('Missing clientId or endpoint', { status: 400 });
    }

    const config = this.configs[endpoint];
    if (!config) {
      return new Response('Invalid endpoint', { status: 400 });
    }

    const now = timestamp || Math.floor(Date.now() / 1000);
    const result = await this.checkRateLimit(clientId, endpoint, config, now);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Reset rate limits for a client (admin function)
   */
  async handleReset(request) {
    const { clientId, endpoint } = await request.json();

    if (clientId && endpoint) {
      const key = `${clientId}:${endpoint}`;
      this.buckets.delete(key);
      await this.state.storage.delete(key);
    } else if (clientId) {
      // Reset all endpoints for client
      for (const endpoint of Object.keys(this.configs)) {
        const key = `${clientId}:${endpoint}`;
        this.buckets.delete(key);
        await this.state.storage.delete(key);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get current rate limit status for a client
   */
  async handleStatus(request) {
    const { clientId } = await request.json();

    if (!clientId) {
      return new Response('Missing clientId', { status: 400 });
    }

    const status = {};
    const now = Math.floor(Date.now() / 1000);

    for (const [endpoint, config] of Object.entries(this.configs)) {
      const key = `${clientId}:${endpoint}`;
      const bucket = await this.getBucket(key);
      const currentCount = this.getCurrentCount(bucket, config, now);

      status[endpoint] = {
        current: currentCount,
        max: config.max,
        window: config.window,
        resetTime: bucket.resetTime || (now + config.window)
      };
    }

    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Core rate limiting logic with atomic operations
   */
  async checkRateLimit(clientId, endpoint, config, now) {
    const key = `${clientId}:${endpoint}`;

    // Get or create bucket for this client/endpoint
    let bucket = await this.getBucket(key);

    // Clean expired requests from sliding window
    this.cleanExpiredRequests(bucket, config, now);

    // Check if adding this request would exceed limit
    if (bucket.requests.length >= config.max) {
      const oldestRequest = Math.min(...bucket.requests);
      const resetTime = oldestRequest + config.window;

      return {
        rateLimited: true,
        resetTime: resetTime,
        retryAfter: resetTime - now,
        current: bucket.requests.length,
        max: config.max
      };
    }

    // Add current request (atomic operation within DO)
    bucket.requests.push(now);
    bucket.lastUpdate = now;

    // Persist to durable storage
    await this.saveBucket(key, bucket);

    return {
      rateLimited: false,
      current: bucket.requests.length,
      max: config.max,
      resetTime: bucket.requests.length > 0 ? Math.min(...bucket.requests) + config.window : now + config.window
    };
  }

  /**
   * Get bucket from memory cache or storage
   */
  async getBucket(key) {
    // Try memory cache first
    if (this.buckets.has(key)) {
      return this.buckets.get(key);
    }

    // Try durable storage
    const stored = await this.state.storage.get(key);
    if (stored) {
      this.buckets.set(key, stored);
      return stored;
    }

    // Create new bucket
    const bucket = {
      requests: [],
      lastUpdate: Math.floor(Date.now() / 1000),
      resetTime: null
    };

    this.buckets.set(key, bucket);
    return bucket;
  }

  /**
   * Save bucket to both memory cache and durable storage
   */
  async saveBucket(key, bucket) {
    this.buckets.set(key, bucket);
    await this.state.storage.put(key, bucket);
  }

  /**
   * Remove expired requests from sliding window
   */
  cleanExpiredRequests(bucket, config, now) {
    const windowStart = now - config.window;
    const originalLength = bucket.requests.length;

    bucket.requests = bucket.requests.filter(timestamp => timestamp > windowStart);

    // If we cleaned any requests, update reset time
    if (bucket.requests.length !== originalLength) {
      bucket.resetTime = bucket.requests.length > 0 ?
        Math.min(...bucket.requests) + config.window :
        null;
    }
  }

  /**
   * Get current request count within window
   */
  getCurrentCount(bucket, config, now) {
    const windowStart = now - config.window;
    return bucket.requests.filter(timestamp => timestamp > windowStart).length;
  }

  /**
   * Handle alarm for periodic cleanup
   */
  async alarm() {
    try {
      const now = Math.floor(Date.now() / 1000);
      const keysToDelete = [];

      // Clean up old buckets from memory and storage
      for (const [key, bucket] of this.buckets.entries()) {
        // If bucket hasn't been updated in 2 hours, remove it
        if (bucket.lastUpdate < now - 7200) {
          keysToDelete.push(key);
        }
      }

      // Remove expired buckets
      for (const key of keysToDelete) {
        this.buckets.delete(key);
        await this.state.storage.delete(key);
      }

      // Schedule next cleanup in 1 hour
      await this.state.storage.setAlarm(Date.now() + 3600000);

    } catch (error) {
      console.error('RateLimitDO alarm error:', error);
    }
  }
}

/**
 * Helper class for interacting with RateLimitDO from other parts of the application
 */
export class AtomicRateLimiter {
  constructor(env) {
    this.env = env;
  }

  /**
   * Check rate limit for a client using Durable Object
   */
  async checkRateLimit(clientId, endpoint, files = []) {
    try {
      // Get the Durable Object instance for this client
      const id = this.env.RATE_LIMIT_DO.idFromName(clientId);
      const stub = this.env.RATE_LIMIT_DO.get(id);

      const response = await stub.fetch('https://rate-limit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          endpoint,
          timestamp: Math.floor(Date.now() / 1000)
        })
      });

      if (!response.ok) {
        throw new Error(`Rate limit check failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.rateLimited) {
        throw new AppError(
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded for ${endpoint}`,
          429,
          {
            retryAfter: result.retryAfter,
            resetTime: result.resetTime,
            current: result.current,
            max: result.max
          }
        );
      }

      return result;

    } catch (error) {
      // If DO is unavailable, fail open (log and allow)
      if (error.name === 'Error' && error.message.includes('Rate limit check failed')) {
        console.error('Rate limit DO unavailable, failing open:', error);
        return { rateLimited: false, failOpen: true };
      }
      throw error;
    }
  }

  /**
   * Get rate limit status for a client
   */
  async getStatus(clientId) {
    try {
      const id = this.env.RATE_LIMIT_DO.idFromName(clientId);
      const stub = this.env.RATE_LIMIT_DO.get(id);

      const response = await stub.fetch('https://rate-limit/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return {};
    }
  }

  /**
   * Reset rate limits for a client (admin function)
   */
  async resetLimits(clientId, endpoint = null) {
    try {
      const id = this.env.RATE_LIMIT_DO.idFromName(clientId);
      const stub = this.env.RATE_LIMIT_DO.get(id);

      const response = await stub.fetch('https://rate-limit/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, endpoint })
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to reset rate limits:', error);
      return { success: false, error: error.message };
    }
  }
}