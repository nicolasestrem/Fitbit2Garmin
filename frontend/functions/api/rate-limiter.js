/**
 * Atomic Rate Limiting Service
 * Multi-tier architecture: D1 (atomic) + KV (cache) + R2 (analytics)
 * Eliminates race conditions through ACID-compliant database transactions
 */

import { MultiTierRateLimiter } from './multi-tier-rate-limiter.js';
import { IntelligentFallback } from './intelligent-fallback.js';

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
    this.env = env;
    this.multiTier = new MultiTierRateLimiter(env);
    this.fallback = new IntelligentFallback(env);
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
   * Uses multi-tier atomic rate limiting with intelligent fallbacks
   * Returns null if allowed, error object if rate limited
   */
  async checkRateLimit(request, type) {
    const clientId = this.getClientId(request);
    const config = RATE_LIMITS[type];

    if (!config) {
      return null; // Unknown type, allow
    }

    try {
      // Map legacy types to new endpoint names
      const endpoint = this.mapLegacyType(type);

      // Collect request metadata for analysis
      const metadata = this.collectMetadata(request);

      // Use intelligent fallback system
      const result = await this.fallback.intelligentRateLimit(
        clientId,
        endpoint,
        this.multiTier
      );

      return null; // Request allowed
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return {
          rateLimited: true,
          resetTime: error.details.resetTime,
          retryAfter: error.details.retryAfter,
          current: error.details.current,
          max: error.details.max
        };
      }

      console.error('Rate limit check failed:', error);
      // Fail open for reliability
      return null;
    }
  }

  /**
   * Map legacy rate limit types to new endpoint names
   */
  mapLegacyType(type) {
    const mapping = {
      'conversions': 'conversions',
      'uploads': 'uploads',
      'files': 'uploads', // File operations use upload limits
      'validations': 'validations',
      'downloads': 'downloads'
    };
    return mapping[type] || 'suspicious';
  }

  /**
   * Collect request metadata for rate limiting analysis
   */
  collectMetadata(request) {
    return {
      userAgent: request.headers.get('user-agent'),
      country: request.cf?.country,
      fingerprint: this.generateFingerprint(request),
      timestamp: Date.now()
    };
  }

  /**
   * Generate client fingerprint for enhanced tracking
   */
  generateFingerprint(request) {
    const components = [
      request.headers.get('user-agent') || '',
      request.headers.get('accept-language') || '',
      request.headers.get('accept-encoding') || '',
      request.cf?.asn || '',
      request.cf?.country || ''
    ];

    // Create a simple hash of the components
    const fingerprint = components.join('|');
    return this.simpleHash(fingerprint).toString(16);
  }

  /**
   * Simple hash function for fingerprinting
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
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
    const endpoint = this.mapLegacyType(type);

    try {
      const status = await this.multiTier.getStatus(clientId);
      const endpointStatus = status.rateLimits[endpoint];

      if (!endpointStatus) {
        const config = RATE_LIMITS[type];
        return { used: 0, remaining: config?.max || 10 };
      }

      return {
        used: endpointStatus.current,
        remaining: Math.max(0, endpointStatus.max - endpointStatus.current),
        resetTime: endpointStatus.resetTime,
        source: status.source
      };
    } catch (error) {
      console.error('Failed to get current usage:', error);
      const config = RATE_LIMITS[type];
      return { used: 0, remaining: config?.max || 10 };
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    try {
      return await this.fallback.getSystemStatus();
    } catch (error) {
      console.error('Failed to get system status:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(timeframe = '24h') {
    try {
      return await this.multiTier.getAnalytics(timeframe);
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Perform system maintenance
   */
  async performMaintenance() {
    try {
      const results = await Promise.allSettled([
        this.multiTier.performMaintenance(),
        this.fallback.performMaintenance()
      ]);

      return {
        multiTier: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
        fallback: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Maintenance failed:', error);
      return { error: error.message };
    }
  }
}

export { RateLimiter };