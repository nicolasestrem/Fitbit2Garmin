/**
 * @file Security hardening utilities for the API.
 * @description This module provides a `SecurityValidator` class with methods to validate
 * various aspects of incoming requests, including filenames, file content, JSON structure,
 * and request headers, to prevent common security vulnerabilities.
 */

import { AppError, ERROR_CODES } from './error-handler.js';

/**
 * @constant {object} SECURITY_CONFIG
 * @description A configuration object containing various security-related thresholds and limits.
 */
const SECURITY_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalSize: 30 * 1024 * 1024, // 30MB total
  allowedMimeTypes: ['application/json', 'text/plain'],
  maxFilenameLength: 255,
  maxJsonDepth: 10,
  maxJsonKeyLength: 100,
  maxJsonValueLength: 1000,
  maxArrayLength: 10000,
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB
  maxHeaderValueLength: 4000,
  suspiciousRequestThreshold: 100, // requests per minute
  blockedIpCacheTtl: 3600, // 1 hour
};

/**
 * A class for performing various security validations on incoming requests.
 */
class SecurityValidator {
  /**
   * Creates an instance of SecurityValidator.
   * @param {object} env - The Cloudflare environment object.
   */
  constructor(env) {
    this.kv = env.RATE_LIMITS;
  }

  /**
   * Validates a filename to prevent path traversal and other attacks.
   * @param {string} filename - The filename to validate.
   * @returns {string} The sanitized filename.
   * @throws {AppError} If the filename is invalid.
   */
  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Invalid filename', 400);
    }
    if (filename.length > SECURITY_CONFIG.maxFilenameLength) {
      throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Filename too long', 400);
    }
    const dangerousPatterns = [/\.\./, /[<>:"|?*]/, /[\x00-\x1f]/, /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(filename)) {
        throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Invalid filename format', 400);
      }
    }
    return filename.normalize('NFKC').replace(/\s+/g, ' ').trim();
  }

  /**
   * Validates the content of a file, checking its size and JSON integrity.
   * @param {string} content - The string content of the file.
   * @param {string} filename - The name of the file, for error reporting.
   * @returns {object} The parsed JSON object.
   * @throws {AppError} If the content is invalid.
   */
  validateFileContent(content, filename) {
    if (!content || typeof content !== 'string') {
      throw new AppError(ERROR_CODES.INVALID_JSON, 'Empty or invalid file content', 400);
    }
    if (content.length > SECURITY_CONFIG.maxFileSize) {
      throw new AppError(ERROR_CODES.FILE_TOO_LARGE, `File ${filename} exceeds size limit`, 413);
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (jsonError) {
      throw new AppError(ERROR_CODES.INVALID_JSON, `Invalid JSON in ${filename}: ${jsonError.message}`, 400);
    }
    this.validateJsonStructure(parsed, filename, 0);
    return parsed;
  }

  /**
   * Recursively validates the structure of a JSON object to prevent abuse.
   * @param {any} obj - The object or array to validate.
   * @param {string} filename - The name of the file, for error reporting.
   * @param {number} [depth=0] - The current recursion depth.
   * @private
   */
  validateJsonStructure(obj, filename, depth = 0) {
    if (depth > SECURITY_CONFIG.maxJsonDepth) {
      throw new AppError(ERROR_CODES.INVALID_JSON, `JSON structure too deep in ${filename}`, 400);
    }
    if (Array.isArray(obj)) {
      if (obj.length > SECURITY_CONFIG.maxArrayLength) throw new AppError(ERROR_CODES.INVALID_JSON, `Array too large in ${filename}`, 400);
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) this.validateJsonStructure(item, filename, depth + 1);
        else if (typeof item === 'string' && item.length > SECURITY_CONFIG.maxJsonValueLength) throw new AppError(ERROR_CODES.INVALID_JSON, `String value too long in ${filename}`, 400);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (key.length > SECURITY_CONFIG.maxJsonKeyLength) throw new AppError(ERROR_CODES.INVALID_JSON, `Object key too long in ${filename}`, 400);
        if (typeof value === 'string' && value.length > SECURITY_CONFIG.maxJsonValueLength) throw new AppError(ERROR_CODES.INVALID_JSON, `String value too long for key '${key}' in ${filename}`, 400);
        else if (typeof value === 'object' && value !== null) this.validateJsonStructure(value, filename, depth + 1);
      }
    }
  }

  /**
   * Validates that the data conforms to the expected Google Takeout format for weight.
   * @param {any} data - The parsed JSON data.
   * @param {string} filename - The name of the file.
   * @returns {boolean} True if the format is valid.
   * @throws {AppError} If the format is invalid.
   */
  validateGoogleTakeoutFormat(data, filename) {
    if (!Array.isArray(data)) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Expected array format in ${filename}`, 422);
    if (data.length === 0) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Empty data array in ${filename}`, 422);
    if (data.length > SECURITY_CONFIG.maxArrayLength) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Too many entries in ${filename}`, 413);

    const firstEntry = data[0];
    if (!firstEntry || typeof firstEntry !== 'object') throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Invalid entry format in ${filename}`, 422);

    const requiredFields = ['logId', 'weight', 'date', 'time'];
    for (const field of requiredFields) {
      if (!(field in firstEntry)) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Missing required field '${field}' in ${filename}`, 422);
    }
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      this.validateTakeoutEntry(data[i], i, filename);
    }
    return true;
  }

  /**
   * Validates the data types and ranges of a single entry from a Takeout file.
   * @param {object} entry - The data entry to validate.
   * @param {number} index - The index of the entry in the array.
   * @param {string} filename - The name of the file.
   * @private
   */
  validateTakeoutEntry(entry, index, filename) {
    if (typeof entry.logId !== 'number' || entry.logId < 0) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Invalid logId at entry ${index} in ${filename}`, 422);
    if (typeof entry.weight !== 'number' || entry.weight < 20 || entry.weight > 1000) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Invalid weight value at entry ${index} in ${filename}`, 422);
    if (typeof entry.date !== 'string' || !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(entry.date)) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Invalid date format at entry ${index} in ${filename}`, 422);
    if (typeof entry.time !== 'string' || !/^\d{1,2}:\d{2}:\d{2}$/.test(entry.time)) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Invalid time format at entry ${index} in ${filename}`, 422);
    if ('fat' in entry && (typeof entry.fat !== 'number' || entry.fat < 0 || entry.fat > 100)) throw new AppError(ERROR_CODES.INVALID_TAKEOUT_FORMAT, `Invalid fat percentage at entry ${index} in ${filename}`, 422);
  }

  /**
   * Checks for and blocks suspicious request patterns based on request frequency.
   * @param {Request} request - The incoming request.
   */
  async checkSuspiciousActivity(request) {
    const clientId = this.getClientId(request);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 60;
    const key = `suspicious:${clientId}`;

    try {
      const existing = await this.kv.get(key);
      let requests = [];
      if (existing) {
        requests = JSON.parse(existing).requests.filter(timestamp => timestamp > windowStart);
      }
      if (requests.length >= SECURITY_CONFIG.suspiciousRequestThreshold) {
        await this.kv.put(`blocked:${clientId}`, JSON.stringify({ blocked_at: now, reason: 'excessive_requests', request_count: requests.length }), { expirationTtl: SECURITY_CONFIG.blockedIpCacheTtl });
        throw new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Suspicious activity detected', 429);
      }
      requests.push(now);
      await this.kv.put(key, JSON.stringify({ requests, lastUpdate: now }), { expirationTtl: 120 });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Suspicious activity check failed:', error);
    }
  }

  /**
   * Checks if a client has been blocked due to suspicious activity.
   * @param {Request} request - The incoming request.
   * @throws {AppError} If the client is currently blocked.
   */
  async isClientBlocked(request) {
    const clientId = this.getClientId(request);
    const key = `blocked:${clientId}`;
    try {
      const blocked = await this.kv.get(key);
      if (blocked) {
        const data = JSON.parse(blocked);
        throw new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, `Access temporarily blocked. Reason: ${data.reason}`, 429);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Block check failed:', error);
    }
  }

  /**
   * Gets a unique client identifier from the request headers.
   * @param {Request} request - The incoming request.
   * @returns {string} The client's IP address.
   */
  getClientId(request) {
    return (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1').trim();
  }

  /**
   * Validates request headers for length and invalid characters.
   * @param {Request} request - The incoming request.
   * @throws {AppError} If any header is invalid.
   */
  validateRequestHeaders(request) {
    for (const [name, value] of request.headers.entries()) {
      if (value.length > SECURITY_CONFIG.maxHeaderValueLength) throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Request header too long', 400);
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Invalid characters in headers', 400);
    }
  }

  /**
   * Adds standard security headers to a response.
   * @param {object} [headers={}] - Existing headers to extend.
   * @returns {object} An object containing the original and new security headers.
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