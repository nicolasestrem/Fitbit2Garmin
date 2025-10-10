/**
 * @file Atomic Rate Limiting Service
 * @description This service provides a comprehensive rate limiting solution using a multi-tier
 * architecture that includes D1 for atomic operations, KV for caching, and R2 for analytics.
 * It is designed to be resilient and eliminate race conditions.
 */

import { MultiTierRateLimiter } from './multi-tier-rate-limiter.js';
import { IntelligentFallback } from './intelligent-fallback.js';
import { PassManager } from './pass-manager.js';
import { DailyLimitTracker } from './daily-limit-tracker.js';

/**
 * @constant {object} RATE_LIMITS
 * @description Configuration for various rate-limited actions.
 */
const RATE_LIMITS = {
  conversions: { window: 3600, max: 10 },
  uploads: { window: 300, max: 20 },
  files: { maxPerConversion: 3, maxSizeBytes: 10 * 1024 * 1024 } // 10MB
};

/**
 * The main RateLimiter class that orchestrates different rate limiting strategies.
 */
class RateLimiter {
  /**
   * Creates an instance of RateLimiter.
   * @param {object} env - The Cloudflare environment object.
   */
  constructor(env) {
    this.env = env;
    this.multiTier = new MultiTierRateLimiter(env);
    this.fallback = new IntelligentFallback(env);
    this.passManager = new PassManager(env);
    this.dailyLimitTracker = new DailyLimitTracker(env);
  }

  /**
   * Gets a unique client identifier from the request, typically the IP address.
   * @param {Request} request - The incoming request object.
   * @returns {string} The client's IP address.
   */
  getClientId(request) {
    return (
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'
    ).trim();
  }

  /**
   * Checks if a request should be rate-limited based on its type.
   * It uses a multi-tier system with intelligent fallbacks for high availability.
   * @param {Request} request - The incoming request.
   * @param {string} type - The type of action being rate-limited (e.g., 'uploads', 'conversions').
   * @returns {Promise<object|null>} Null if the request is allowed, or an object with rate limit details if exceeded.
   */
  async checkRateLimit(request, type) {
    const clientId = this.getClientId(request);
    const config = RATE_LIMITS[type];
    if (!config) return null; // Allow if type is unknown

    try {
      const endpoint = this.mapLegacyType(type);
      const metadata = this.collectMetadata(request);
      await this.fallback.intelligentRateLimit(clientId, endpoint, this.multiTier);
      return null; // Allowed
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
      return null; // Fail open for reliability
    }
  }

  /**
   * Maps legacy rate limit types to new endpoint names for consistency.
   * @param {string} type - The legacy type name.
   * @returns {string} The corresponding new endpoint name.
   * @private
   */
  mapLegacyType(type) {
    const mapping = {
      conversions: 'conversions',
      uploads: 'uploads',
      files: 'uploads',
      validations: 'validations',
      downloads: 'downloads'
    };
    return mapping[type] || 'suspicious';
  }

  /**
   * Collects metadata from the request for logging and analysis.
   * @param {Request} request - The incoming request.
   * @returns {object} An object containing request metadata.
   * @private
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
   * Generates a simple client fingerprint for more robust tracking.
   * @param {Request} request - The incoming request.
   * @returns {string} A hex-encoded hash representing the fingerprint.
   * @private
   */
  generateFingerprint(request) {
    const components = [
      request.headers.get('user-agent') || '',
      request.headers.get('accept-language') || '',
      request.headers.get('accept-encoding') || '',
      request.cf?.asn || '',
      request.cf?.country || ''
    ];
    return this.simpleHash(components.join('|')).toString(16);
  }

  /**
   * A simple, non-cryptographic hash function.
   * @param {string} str - The string to hash.
   * @returns {number} The hash result.
   * @private
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash &= hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Placeholder for recording a successful operation, as the counter is now
   * incremented atomically during the check.
   * @param {Request} request - The incoming request.
   * @param {string} type - The type of operation.
   */
  async recordSuccessfulOperation(request, type) {
    console.log(`Rate limit: ${type} operation completed for ${this.getClientId(request)}`);
  }

  /**
   * Checks if a user can convert a certain number of files based on daily limits
   * for the free tier. Users with an active pass bypass this check.
   * @param {Request} request - The incoming request.
   * @param {number} filesCount - The number of files to be converted.
   * @returns {Promise<object>} An object detailing whether the conversion is allowed.
   */
  async checkDailyLimit(request, filesCount) {
    const clientId = this.getClientId(request);
    try {
      if (await this.passManager.hasActivePass(clientId)) {
        const passDetails = await this.passManager.getActivePass(clientId);
        return { allowed: true, hasPass: true, passType: passDetails?.passType, expiresAt: passDetails?.expiresAt, filesRemaining: 999 };
      }

      const canConvert = await this.dailyLimitTracker.canConvert(clientId, filesCount);
      if (!canConvert.allowed) {
        return {
          allowed: false, hasPass: false, filesUsed: canConvert.filesConverted,
          filesRemaining: canConvert.filesRemaining, limit: canConvert.limit,
          resetTime: canConvert.resetTime, wouldExceed: canConvert.wouldExceed,
          excessFiles: canConvert.excessFiles
        };
      }
      return {
        allowed: true, hasPass: false, filesUsed: canConvert.filesConverted,
        filesRemaining: canConvert.filesRemaining, limit: canConvert.limit,
        resetTime: canConvert.resetTime
      };
    } catch (error) {
      console.error('Daily limit check failed:', error);
      return { allowed: true, hasPass: false, error: true, filesRemaining: 3 }; // Fail open
    }
  }

  /**
   * Records a successful conversion for a free-tier user to track daily limits.
   * @param {string} clientId - The client identifier.
   * @param {number} filesCount - The number of files converted.
   * @returns {Promise<boolean>} True if the conversion was recorded successfully.
   */
  async recordConversion(clientId, filesCount) {
    try {
      if (await this.passManager.hasActivePass(clientId)) {
        return true; // Don't track for pass holders.
      }
      return await this.dailyLimitTracker.recordConversion(clientId, filesCount);
    } catch (error) {
      console.error('Failed to record conversion:', error);
      return false;
    }
  }

  /**
   * Validates an array of files against configured size and count limits.
   * @param {File[]} files - An array of File objects to validate.
   * @returns {{valid: boolean, error?: string}} An object indicating if the files are valid.
   */
  validateFiles(files) {
    if (!files || !Array.isArray(files)) return { valid: false, error: 'No files provided' };
    if (files.length > RATE_LIMITS.files.maxPerConversion) {
      return { valid: false, error: `Maximum ${RATE_LIMITS.files.maxPerConversion} files allowed per conversion` };
    }
    for (const file of files) {
      if (file.size > RATE_LIMITS.files.maxSizeBytes) {
        return { valid: false, error: `File "${file.name}" is too large. Maximum size is ${Math.floor(RATE_LIMITS.files.maxSizeBytes / 1024 / 1024)}MB` };
      }
    }
    return { valid: true };
  }

  /**
   * Creates HTTP headers related to rate limiting to be sent in a response.
   * @param {string} type - The type of action being rate-limited.
   * @param {number|null} [remaining=null] - The number of remaining requests in the window.
   * @returns {object} An object of HTTP headers.
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
   * Creates a standard `Response` object for a 429 "Too Many Requests" error.
   * @param {object} rateLimitResult - The result from the rate limit check.
   * @param {object} corsHeaders - The CORS headers to include in the response.
   * @returns {Response} A Response object.
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
   * Gets the current usage for a client for monitoring purposes.
   * @param {Request} request - The incoming request.
   * @param {string} type - The type of action.
   * @returns {Promise<object>} The client's current usage statistics.
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
   * Gets a comprehensive status of the entire rate limiting system.
   * @returns {Promise<object>} The system status.
   */
  async getSystemStatus() {
    try {
      return await this.fallback.getSystemStatus();
    } catch (error) {
      console.error('Failed to get system status:', error);
      return { error: error.message, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Retrieves analytics data for a given time frame.
   * @param {string} [timeframe='24h'] - The time frame for analytics.
   * @returns {Promise<object>} The analytics data.
   */
  async getAnalytics(timeframe = '24h') {
    try {
      return await this.multiTier.getAnalytics(timeframe);
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return { error: error.message, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Performs periodic system maintenance tasks.
   * @returns {Promise<object>} The result of the maintenance operations.
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