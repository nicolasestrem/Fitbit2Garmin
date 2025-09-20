/**
 * Enhanced rate limiting service using Durable Objects for atomic operations
 * Falls back to Cloudflare KV for compatibility and availability
 * Implements sliding window rate limiting without exposing limits to users
 */

import { AtomicRateLimiter } from './rate-limit-do.js';

// Rate limiting configuration
const RATE_LIMITS = {
  conversions: {
    window: 3600, // 1 hour in seconds
    max: 10, // max conversions per hour per IP
  },
  uploads: {
    window: 300, // 5 minutes in seconds
    max: 20, // max uploads per 5 minutes per IP
  },
  files: {
    maxPerConversion: 3, // max files per conversion
    maxSizeBytes: 10 * 1024 * 1024, // 10MB per file
  }
};

class RateLimiter {
  constructor(env) {
    this.kv = env.RATE_LIMITS;
    this.atomicLimiter = env.RATE_LIMIT_DO ? new AtomicRateLimiter(env) : null;
    this.useDurableObjects = !!env.RATE_LIMIT_DO;
  }

  /**
   * Get client identifier from request (IP address)
   */
  getClientId(request) {
    // Try multiple headers for IP address (Cloudflare provides these)
    const ip = request.headers.get('cf-connecting-ip') ||
               request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    return ip.trim();
  }

  /**
   * Generate KV key for rate limiting
   */
  getRateLimitKey(clientId, type) {
    return `rate_limit:${type}:${clientId}`;
  }

  /**
   * Check if request should be rate limited
   * Uses Durable Objects for atomic operations, falls back to KV
   * Returns null if allowed, error object if rate limited
   */
  async checkRateLimit(request, type) {
    const clientId = this.getClientId(request);
    const config = RATE_LIMITS[type];

    if (!config) {
      return null; // Unknown type, allow
    }

    // Try Durable Objects first for atomic operations
    if (this.useDurableObjects && this.atomicLimiter) {
      try {
        const result = await this.atomicLimiter.checkRateLimit(clientId, type);

        if (result.failOpen) {
          // DO is unavailable, fall back to KV
          console.warn('Durable Objects unavailable, falling back to KV rate limiting');
          return await this.checkRateLimitKV(clientId, config, type);
        }

        return null; // Request allowed by DO
      } catch (error) {
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          return {
            rateLimited: true,
            resetTime: error.details.resetTime,
            retryAfter: error.details.retryAfter
          };
        }

        // DO error, fall back to KV
        console.warn('Durable Objects error, falling back to KV:', error);
        return await this.checkRateLimitKV(clientId, config, type);
      }
    }

    // Use KV as fallback or primary (if DO not available)
    return await this.checkRateLimitKV(clientId, config, type);
  }

  /**
   * KV-based rate limiting (fallback implementation)
   * Note: This has race condition vulnerabilities but provides availability
   */
  async checkRateLimitKV(clientId, config, type) {
    const key = this.getRateLimitKey(clientId, type);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    try {
      // Get existing rate limit data
      const existing = await this.kv.get(key);
      let requests = [];

      if (existing) {
        const data = JSON.parse(existing);
        // Filter out old requests outside the window
        requests = data.requests.filter(timestamp => timestamp > windowStart);
      }

      // Check if adding this request would exceed limit
      if (requests.length >= config.max) {
        const oldestRequest = Math.min(...requests);
        const resetTime = oldestRequest + config.window;

        return {
          rateLimited: true,
          resetTime: resetTime,
          retryAfter: resetTime - now
        };
      }

      // Add current request timestamp
      requests.push(now);

      // Store updated data with TTL
      await this.kv.put(key, JSON.stringify({
        requests: requests,
        lastUpdate: now
      }), { expirationTtl: config.window + 60 }); // TTL slightly longer than window

      return null; // Request allowed
    } catch (error) {
      console.error('KV rate limit check failed:', error);
      // On error, allow the request (fail open)
      return null;
    }
  }

  /**
   * Increment rate limit counter after successful operation
   */
  async recordSuccessfulOperation(request, type) {
    // The counter is already incremented in checkRateLimit
    // This method exists for potential future logging/analytics
    const clientId = this.getClientId(request);
    console.log(`Rate limit: ${type} operation completed for ${clientId}`);
  }

  /**
   * Check file-specific limits
   */
  validateFiles(files) {
    if (!files || !Array.isArray(files)) {
      return { valid: false, error: 'No files provided' };
    }

    if (files.length > RATE_LIMITS.files.maxPerConversion) {
      return {
        valid: false,
        error: `Maximum ${RATE_LIMITS.files.maxPerConversion} files allowed per conversion`
      };
    }

    for (const file of files) {
      if (file.size > RATE_LIMITS.files.maxSizeBytes) {
        return {
          valid: false,
          error: `File "${file.name}" is too large. Maximum size is ${Math.floor(RATE_LIMITS.files.maxSizeBytes / (1024 * 1024))}MB`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Create rate limit response headers
   */
  createRateLimitHeaders(type, remaining = null) {
    const config = RATE_LIMITS[type];
    if (!config) return {};

    const headers = {
      'X-RateLimit-Window': config.window.toString(),
      'X-RateLimit-Limit': config.max.toString(),
    };

    if (remaining !== null) {
      headers['X-RateLimit-Remaining'] = Math.max(0, remaining).toString();
    }

    return headers;
  }

  /**
   * Create rate limited error response
   */
  createRateLimitResponse(rateLimitResult, corsHeaders) {
    const retryAfter = Math.max(1, rateLimitResult.retryAfter);

    return new Response(JSON.stringify({
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later.",
      retry_after: retryAfter
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      }
    });
  }

  /**
   * Get current usage for a client (for internal monitoring)
   */
  async getCurrentUsage(request, type) {
    const clientId = this.getClientId(request);
    const config = RATE_LIMITS[type];
    const key = this.getRateLimitKey(clientId, type);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    try {
      const existing = await this.kv.get(key);
      if (!existing) return { used: 0, remaining: config.max };

      const data = JSON.parse(existing);
      const activeRequests = data.requests.filter(timestamp => timestamp > windowStart);

      return {
        used: activeRequests.length,
        remaining: Math.max(0, config.max - activeRequests.length)
      };
    } catch (error) {
      console.error('Failed to get current usage:', error);
      return { used: 0, remaining: config.max };
    }
  }
}

export { RateLimiter };