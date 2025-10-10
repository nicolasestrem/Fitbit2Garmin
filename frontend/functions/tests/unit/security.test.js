import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityValidator, SECURITY_CONFIG } from '../../api/security.js';
import { AppError } from '../../api/error-handler.js';

// Helper to create a mock request object
const createMockRequest = (headers = {}, url = 'https://example.com/api/upload') => {
    const headerMap = new Map(Object.entries(headers));
    return {
      headers: {
        get: (key) => headerMap.get(key.toLowerCase()),
        entries: () => headerMap.entries(),
      },
      url,
    };
  };

describe('SecurityValidator', () => {
  let securityValidator;
  let mockEnv;
  let mockKV;

  beforeEach(() => {
    const store = new Map();
    mockKV = {
      get: vi.fn(async (key) => store.get(key) || null),
      put: vi.fn(async (key, value) => store.set(key, value)),
    };
    mockEnv = { RATE_LIMITS: mockKV };
    securityValidator = new SecurityValidator(mockEnv);
  });

  describe('validateFilename', () => {
    it('should allow valid filenames', () => {
      expect(() => securityValidator.validateFilename('weight-2024-01-01.json')).not.toThrow();
    });

    it('should reject path traversal attempts', () => {
      expect(() => securityValidator.validateFilename('../../../etc/passwd')).toThrow(AppError);
    });

    it('should reject invalid characters', () => {
      expect(() => securityValidator.validateFilename('file<script>.json')).toThrow(AppError);
    });

    it('should reject control characters', () => {
        expect(() => securityValidator.validateFilename('file\x00null.json')).toThrow(AppError);
    });

    it('should reject Windows reserved names', () => {
        expect(() => securityValidator.validateFilename('CON.json')).toThrow(AppError);
    });
  });

  describe('validateFileContent', () => {
    it('should reject content that is too large', () => {
      const largeContent = 'a'.repeat(SECURITY_CONFIG.maxFileSize + 1);
      expect(() => securityValidator.validateFileContent(largeContent, 'large.json')).toThrow(AppError);
    });
  });

  describe('validateGoogleTakeoutFormat', () => {
    it('should accept a valid format', () => {
        const validData = [{ logId: 1, weight: 70, date: '01/01/24', time: '12:00:00' }];
        expect(() => securityValidator.validateGoogleTakeoutFormat(validData, 'valid.json')).not.toThrow();
      });

      it('should reject entries with missing required fields', () => {
        const invalidData = [{ logId: 1, date: '01/01/24', time: '12:00:00' }]; // Missing weight
        expect(() => securityValidator.validateGoogleTakeoutFormat(invalidData, 'invalid.json')).toThrow(AppError);
      });
  });

  describe('validateTakeoutEntry', () => {
    it('should accept a valid entry', () => {
        const validEntry = { logId: 1, weight: 70, date: '01/01/24', time: '12:00:00' };
        expect(() => securityValidator.validateTakeoutEntry(validEntry, 0, 'valid.json')).not.toThrow();
      });

      it('should reject an entry with an invalid date', () => {
        const invalidEntry = { logId: 1, weight: 70, date: 'invalid-date', time: '12:00:00' };
        expect(() => securityValidator.validateTakeoutEntry(invalidEntry, 0, 'invalid.json')).toThrow(AppError);
      });
  });

  describe('checkSuspiciousActivity', () => {
    it('should block suspicious request patterns', async () => {
      const request = createMockRequest({ 'cf-connecting-ip': '192.168.1.1' });
      const now = Math.floor(Date.now() / 1000);
      const suspiciousData = { requests: Array(SECURITY_CONFIG.suspiciousRequestThreshold).fill(now) };
      mockKV.get.mockResolvedValue(JSON.stringify(suspiciousData));

      await expect(securityValidator.checkSuspiciousActivity(request)).rejects.toThrow(AppError);
    });
  });

  describe('isClientBlocked', () => {
    it('should allow non-blocked clients', async () => {
        const request = createMockRequest({ 'cf-connecting-ip': '192.168.1.1' });
        mockKV.get.mockResolvedValue(null);
        await expect(securityValidator.isClientBlocked(request)).resolves.toBeUndefined();
      });

      it('should block previously flagged clients', async () => {
        const request = createMockRequest({ 'cf-connecting-ip': '192.168.1.1' });
        mockKV.get.mockResolvedValue(JSON.stringify({ blocked: true }));
        await expect(securityValidator.isClientBlocked(request)).rejects.toThrow(AppError);
      });
  });

  describe('validateRequestHeaders', () => {
    it('should validate normal headers', () => {
      const request = createMockRequest({ 'User-Agent': 'test' });
      expect(() => securityValidator.validateRequestHeaders(request)).not.toThrow();
    });

    it('should reject headers that are too long', () => {
      const request = createMockRequest({ 'X-Long-Header': 'a'.repeat(SECURITY_CONFIG.maxHeaderValueLength + 1) });
      expect(() => securityValidator.validateRequestHeaders(request)).toThrow(AppError);
    });

    it('should reject headers with control characters', () => {
      const request = createMockRequest({ 'X-Bad-Header': 'value\x01' });
      expect(() => securityValidator.validateRequestHeaders(request)).toThrow(AppError);
    });
  });
});