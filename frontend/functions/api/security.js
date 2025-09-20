/**
 * Security hardening utilities for the API
 */

import { AppError, ERROR_CODES } from './error-handler.js';

// Security configuration
const SECURITY_CONFIG = {
  // File validation
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalSize: 30 * 1024 * 1024, // 30MB total
  allowedMimeTypes: ['application/json', 'text/plain'],
  maxFilenameLength: 255,

  // Content validation
  maxJsonDepth: 10,
  maxJsonKeyLength: 100,
  maxJsonValueLength: 1000,
  maxArrayLength: 10000,

  // Request validation
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB
  maxHeaderValueLength: 4000,

  // Rate limiting thresholds for suspicious activity
  suspiciousRequestThreshold: 100, // requests per minute
  blockedIpCacheTtl: 3600, // 1 hour
};

class SecurityValidator {
  constructor(env) {
    this.kv = env.RATE_LIMITS;
  }

  /**
   * Validate filename for security issues
   */
  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Invalid filename', 400);
    }

    // Check filename length
    if (filename.length > SECURITY_CONFIG.maxFilenameLength) {
      throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Filename too long', 400);
    }

    // Check for path traversal attempts
    const dangerousPatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Invalid filename characters
      /[\x00-\x1f]/,    // Control characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(filename)) {
        throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Invalid filename format', 400);
      }
    }

    // Normalize and sanitize
    const sanitized = filename
      .normalize('NFKC') // Unicode normalization
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return sanitized;
  }

  /**
   * Validate file content for security issues
   */
  validateFileContent(content, filename) {
    if (!content || typeof content !== 'string') {
      throw new AppError(ERROR_CODES.INVALID_JSON, 'Empty or invalid file content', 400);
    }

    // Check content size
    if (content.length > SECURITY_CONFIG.maxFileSize) {
      throw new AppError(ERROR_CODES.FILE_TOO_LARGE, `File ${filename} exceeds size limit`, 413);
    }

    // Parse and validate JSON structure
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (jsonError) {
      throw new AppError(ERROR_CODES.INVALID_JSON, `Invalid JSON in ${filename}: ${jsonError.message}`, 400);
    }

    // Validate JSON structure depth and content
    this.validateJsonStructure(parsed, filename, 0);

    return parsed;
  }

  /**
   * Recursively validate JSON structure for security issues
   */
  validateJsonStructure(obj, filename, depth = 0) {
    // Check recursion depth
    if (depth > SECURITY_CONFIG.maxJsonDepth) {
      throw new AppError(ERROR_CODES.INVALID_JSON, `JSON structure too deep in ${filename}`, 400);
    }

    if (Array.isArray(obj)) {
      if (obj.length > SECURITY_CONFIG.maxArrayLength) {
        throw new AppError(ERROR_CODES.INVALID_JSON, `Array too large in ${filename}`, 400);
      }

      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          this.validateJsonStructure(item, filename, depth + 1);
        } else if (typeof item === 'string' && item.length > SECURITY_CONFIG.maxJsonValueLength) {
          throw new AppError(ERROR_CODES.INVALID_JSON, `String value too long in ${filename}`, 400);
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        // Validate key length
        if (key.length > SECURITY_CONFIG.maxJsonKeyLength) {
          throw new AppError(ERROR_CODES.INVALID_JSON, `Object key too long in ${filename}`, 400);
        }

        // Validate value
        if (typeof value === 'string' && value.length > SECURITY_CONFIG.maxJsonValueLength) {
          throw new AppError(ERROR_CODES.INVALID_JSON, `String value too long for key '${key}' in ${filename}`, 400);
        } else if (typeof value === 'object' && value !== null) {
          this.validateJsonStructure(value, filename, depth + 1);
        }
      }
    }
  }

  /**
   * Validate Google Takeout format with security checks
   */
  validateGoogleTakeoutFormat(data, filename) {
    if (!Array.isArray(data)) {
      throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Expected array format in ${filename}`, 422);
    }

    if (data.length === 0) {
      throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Empty data array in ${filename}`, 422);
    }

    // Check array size
    if (data.length > SECURITY_CONFIG.maxArrayLength) {
      throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Too many entries in ${filename}`, 413);
    }

    // Validate first entry structure
    const firstEntry = data[0];
    if (!firstEntry || typeof firstEntry !== 'object') {
      throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Invalid entry format in ${filename}`, 422);
    }

    const requiredFields = ['logId', 'weight', 'date', 'time'];
    for (const field of requiredFields) {
      if (!(field in firstEntry)) {
        throw new AppError(
          ERROR_CODES.INVALID_TAKEOUT_FORMAT,
          `Missing required field '${field}' in ${filename}`,
          422
        );
      }
    }

    // Validate data types and ranges
    for (let i = 0; i < Math.min(data.length, 10); i++) { // Validate first 10 entries
      const entry = data[i];
      this.validateTakeoutEntry(entry, i, filename);
    }

    return true;
  }

  /**
   * Validate individual Takeout entry
   */
  validateTakeoutEntry(entry, index, filename) {
    // Validate logId
    if (typeof entry.logId !== 'number' || entry.logId < 0) {
      throw new AppError(
        ERROR_CODES.INVALID_TAKEOUT_FORMAT,
        `Invalid logId at entry ${index} in ${filename}`,
        422
      );
    }

    // Validate weight (reasonable human weight range)
    if (typeof entry.weight !== 'number' || entry.weight < 20 || entry.weight > 1000) {
      throw new AppError(
        ERROR_CODES.INVALID_TAKEOUT_FORMAT,
        `Invalid weight value at entry ${index} in ${filename}`,
        422
      );
    }

    // Validate date format (MM/DD/YY or MM/DD/YYYY)
    if (typeof entry.date !== 'string' || !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(entry.date)) {
      throw new AppError(
        ERROR_CODES.INVALID_TAKEOUT_FORMAT,
        `Invalid date format at entry ${index} in ${filename}`,
        422
      );
    }

    // Validate time format (HH:MM:SS)
    if (typeof entry.time !== 'string' || !/^\d{1,2}:\d{2}:\d{2}$/.test(entry.time)) {
      throw new AppError(
        ERROR_CODES.INVALID_TAKEOUT_FORMAT,
        `Invalid time format at entry ${index} in ${filename}`,
        422
      );
    }

    // Validate optional fat percentage
    if ('fat' in entry && (typeof entry.fat !== 'number' || entry.fat < 0 || entry.fat > 100)) {
      throw new AppError(
        ERROR_CODES.INVALID_TAKEOUT_FORMAT,
        `Invalid fat percentage at entry ${index} in ${filename}`,
        422
      );
    }
  }

  /**
   * Check for suspicious request patterns
   */
  async checkSuspiciousActivity(request) {
    const clientId = this.getClientId(request);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 60; // 1 minute window

    const key = `suspicious:${clientId}`;

    try {
      const existing = await this.kv.get(key);
      let requests = [];

      if (existing) {
        const data = JSON.parse(existing);
        requests = data.requests.filter(timestamp => timestamp > windowStart);
      }

      // Check if this client is making too many requests
      if (requests.length >= SECURITY_CONFIG.suspiciousRequestThreshold) {
        // Mark as potentially malicious
        await this.kv.put(`blocked:${clientId}`, JSON.stringify({
          blocked_at: now,
          reason: 'excessive_requests',
          request_count: requests.length
        }), { expirationTtl: SECURITY_CONFIG.blockedIpCacheTtl });

        throw new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Suspicious activity detected', 429);
      }

      // Record this request
      requests.push(now);
      await this.kv.put(key, JSON.stringify({
        requests: requests,
        lastUpdate: now
      }), { expirationTtl: 120 }); // 2 minute TTL

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // Don't fail the request on monitoring errors
      console.error('Suspicious activity check failed:', error);
    }
  }

  /**
   * Check if client is blocked
   */
  async isClientBlocked(request) {
    const clientId = this.getClientId(request);
    const key = `blocked:${clientId}`;

    try {
      const blocked = await this.kv.get(key);
      if (blocked) {
        const data = JSON.parse(blocked);
        throw new AppError(
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          `Access temporarily blocked. Reason: ${data.reason}`,
          429
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // Don't fail the request on check errors
      console.error('Block check failed:', error);
    }
  }

  /**
   * Get client identifier (same as rate limiter)
   */
  getClientId(request) {
    const ip = request.headers.get('cf-connecting-ip') ||
               request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    return ip.trim();
  }

  /**
   * Validate request headers for security issues
   */
  validateRequestHeaders(request) {
    const headers = request.headers;

    // Check for excessively long headers
    for (const [name, value] of headers.entries()) {
      if (value.length > SECURITY_CONFIG.maxHeaderValueLength) {
        throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Request header too long', 400);
      }

      // Check for suspicious header patterns
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
        throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Invalid characters in headers', 400);
      }
    }
  }

  /**
   * Add security headers to response
   */
  addSecurityHeaders(headers = {}) {
    return {
      ...headers,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
    };
  }
}

export { SecurityValidator, SECURITY_CONFIG };