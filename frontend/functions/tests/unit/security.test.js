import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityValidator } from '../../api/security.js';

describe('SecurityValidator', () => {
  let securityValidator;
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      RATE_LIMITS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };
    securityValidator = new SecurityValidator(mockEnv);
  });

  describe('validateFilename', () => {
    it('should validate normal filenames', () => {
      const result = securityValidator.validateFilename('weight-2024-01-01.json');
      expect(result).toBe('weight-2024-01-01.json');
    });

    it('should reject null or undefined filenames', () => {
      expect(() => securityValidator.validateFilename(null)).toThrow('Only JSON files from Google Takeout are supported.');
      expect(() => securityValidator.validateFilename(undefined)).toThrow('Only JSON files from Google Takeout are supported.');
      expect(() => securityValidator.validateFilename('')).toThrow('Only JSON files from Google Takeout are supported.');
    });

    it('should reject filenames that are too long', () => {
      const longFilename = 'a'.repeat(300);
      expect(() => securityValidator.validateFilename(longFilename)).toThrow('Only JSON files from Google Takeout are supported.');
    });

    it('should reject path traversal attempts', () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        'test/../../../etc/passwd',
        'test\\..\\..\\windows',
        'normal-file../../../secret'
      ];

      maliciousFilenames.forEach(filename => {
        expect(() => securityValidator.validateFilename(filename)).toThrow('Only JSON files from Google Takeout are supported.');
      });
    });

    it('should reject filenames with invalid characters', () => {
      const invalidFilenames = [
        'file<script>.json',
        'file>alert.json',
        'file|pipe.json',
        'file:colon.json',
        'file"quote.json',
        'file*wildcard.json'
      ];

      invalidFilenames.forEach(filename => {
        expect(() => securityValidator.validateFilename(filename)).toThrow('Only JSON files from Google Takeout are supported.');
      });
    });

    it('should reject filenames with control characters', () => {
      const controlCharFilenames = [
        'file\x00null.json',
        'file\x01start.json',
        'file\x1funit.json',
        'file\x7fdelete.json'
      ];

      controlCharFilenames.forEach(filename => {
        expect(() => securityValidator.validateFilename(filename)).toThrow('Only JSON files from Google Takeout are supported.');
      });
    });

    it('should reject Windows reserved names', () => {
      const reservedNames = [
        'CON.json',
        'PRN.json',
        'AUX.json',
        'NUL.json',
        'COM1.json',
        'LPT1.json'
      ];

      reservedNames.forEach(filename => {
        expect(() => securityValidator.validateFilename(filename)).toThrow('Only JSON files from Google Takeout are supported.');
      });
    });
  });

  describe('validateFileContent', () => {
    it('should validate normal JSON content', () => {
      const content = '{"valid": "json", "data": [1, 2, 3]}';
      expect(() => securityValidator.validateFileContent(content)).not.toThrow();
    });

    it('should reject empty or null content', () => {
      expect(() => securityValidator.validateFileContent(null)).toThrow('One or more files contain invalid JSON data.');
      expect(() => securityValidator.validateFileContent('')).toThrow('One or more files contain invalid JSON data.');
      expect(() => securityValidator.validateFileContent(undefined)).toThrow('One or more files contain invalid JSON data.');
    });

    it('should reject content that is too large', () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      expect(() => securityValidator.validateFileContent(largeContent)).toThrow('One or more files exceed the maximum allowed size of 10MB.');
    });

    it('should reject invalid JSON', () => {
      const invalidJson = '{"invalid": json}';
      expect(() => securityValidator.validateFileContent(invalidJson)).toThrow('One or more files contain invalid JSON data.');
    });
  });

  describe('validateJsonStructure', () => {
    it('should validate normal JSON structures', () => {
      const normalData = {
        activities: [
          { id: 1, name: 'test' },
          { id: 2, name: 'test2' }
        ]
      };
      expect(() => securityValidator.validateJsonStructure(normalData)).not.toThrow();
    });

    it('should reject deeply nested objects', () => {
      let deepObject = {};
      let current = deepObject;
      for (let i = 0; i < 20; i++) {
        current.nested = {};
        current = current.nested;
      }
      expect(() => securityValidator.validateJsonStructure(deepObject)).toThrow('One or more files contain invalid JSON data.');
    });

    it('should reject arrays that are too large', () => {
      const largeArray = new Array(15000).fill('item');
      expect(() => securityValidator.validateJsonStructure({ data: largeArray })).toThrow('One or more files contain invalid JSON data.');
    });

    it('should reject object keys that are too long', () => {
      const longKey = 'x'.repeat(150);
      const objectWithLongKey = { [longKey]: 'value' };
      expect(() => securityValidator.validateJsonStructure(objectWithLongKey)).toThrow('One or more files contain invalid JSON data.');
    });

    it('should reject string values that are too long', () => {
      const longValue = 'x'.repeat(1500);
      const objectWithLongValue = { key: longValue };
      expect(() => securityValidator.validateJsonStructure(objectWithLongValue)).toThrow('One or more files contain invalid JSON data.');
    });
  });

  describe('validateGoogleTakeoutFormat', () => {
    it('should validate correct takeout format', () => {
      const validData = [
        {
          logId: 12345,
          weight: 70.5,
          fat: 15.2,
          date: '2024-01-01',
          time: '08:00:00'
        }
      ];
      expect(() => securityValidator.validateGoogleTakeoutFormat(validData)).not.toThrow();
    });

    it('should reject non-array data', () => {
      const invalidData = { logId: 123, weight: 70 };
      expect(() => securityValidator.validateGoogleTakeoutFormat(invalidData)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });

    it('should reject empty arrays', () => {
      expect(() => securityValidator.validateGoogleTakeoutFormat([])).toThrow("Files don't match the expected Google Takeout weight data format.");
    });

    it('should reject arrays with too many entries', () => {
      const tooManyEntries = new Array(12000).fill({
        logId: 123,
        weight: 70,
        date: '2024-01-01',
        time: '08:00:00'
      });
      expect(() => securityValidator.validateGoogleTakeoutFormat(tooManyEntries)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });

    it('should reject data with missing required fields', () => {
      const invalidEntry = [{ weight: 70, date: '2024-01-01' }]; // Missing logId
      expect(() => securityValidator.validateGoogleTakeoutFormat(invalidEntry)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });

    it('should reject data with invalid first entry', () => {
      const invalidEntry = [{ logId: 'not-a-number', weight: 70, date: '2024-01-01', time: '08:00:00' }];
      expect(() => securityValidator.validateGoogleTakeoutFormat(invalidEntry)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });
  });

  describe('validateTakeoutEntry', () => {
    it('should validate correct entry format', () => {
      const validEntry = {
        logId: 12345,
        weight: 70.5,
        fat: 15.2,
        date: '2024-01-01',
        time: '08:00:00'
      };
      expect(() => securityValidator.validateTakeoutEntry(validEntry)).not.toThrow();
    });

    it('should reject invalid logId', () => {
      const invalidEntry = { logId: 'not-a-number', weight: 70, date: '2024-01-01', time: '08:00:00' };
      expect(() => securityValidator.validateTakeoutEntry(invalidEntry)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });

    it('should reject invalid weight values', () => {
      const invalidEntry = { logId: 123, weight: 'not-a-number', date: '2024-01-01', time: '08:00:00' };
      expect(() => securityValidator.validateTakeoutEntry(invalidEntry)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });

    it('should reject invalid date formats', () => {
      const invalidEntry = { logId: 123, weight: 70, date: 'invalid-date', time: '08:00:00' };
      expect(() => securityValidator.validateTakeoutEntry(invalidEntry)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });

    it('should reject invalid time formats', () => {
      const invalidEntry = { logId: 123, weight: 70, date: '2024-01-01', time: 'invalid-time' };
      expect(() => securityValidator.validateTakeoutEntry(invalidEntry)).toThrow();
    });

    it('should reject invalid fat percentage', () => {
      const invalidEntry = { logId: 123, weight: 70, fat: 150, date: '2024-01-01', time: '08:00:00' };
      expect(() => securityValidator.validateTakeoutEntry(invalidEntry)).toThrow("Files don't match the expected Google Takeout weight data format.");
    });
  });

  describe('checkSuspiciousActivity', () => {
    it('should allow normal request patterns', async () => {
      const request = {
        headers: { get: () => '192.168.1.1' },
        url: 'https://example.com/api/upload'
      };

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);
      mockEnv.RATE_LIMITS.put.mockResolvedValue();

      await expect(securityValidator.checkSuspiciousActivity(request)).resolves.not.toThrow();
    });

    it('should block suspicious request patterns', async () => {
      const request = {
        headers: { get: () => '192.168.1.1' },
        url: 'https://example.com/api/upload'
      };

      // Mock suspicious activity data
      const now = Math.floor(Date.now() / 1000);
      const suspiciousData = Array.from({ length: 150 }, (_, i) => now - i);

      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: suspiciousData,
        lastUpdate: now
      }));

      await expect(securityValidator.checkSuspiciousActivity(request)).rejects.toThrow('Too Many Requests');
    });
  });

  describe('isClientBlocked', () => {
    it('should allow non-blocked clients', async () => {
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const result = await securityValidator.isClientBlocked('192.168.1.1');
      expect(result).toBe(false);
    });

    it('should block previously flagged clients', async () => {
      const blockData = { blocked: true, timestamp: Date.now() };
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify(blockData));

      await expect(securityValidator.isClientBlocked('192.168.1.1')).rejects.toThrow('Too Many Requests');
    });
  });

  describe('validateRequestHeaders', () => {
    it('should validate normal headers', () => {
      const normalHeaders = {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 Firefox/100.0'
      };
      expect(() => securityValidator.validateRequestHeaders(normalHeaders)).not.toThrow();
    });

    it('should reject headers that are too long', () => {
      const longValue = 'x'.repeat(5000);
      const longHeaders = { 'long-header': longValue };
      expect(() => securityValidator.validateRequestHeaders(longHeaders)).toThrow('Only JSON files from Google Takeout are supported.');
    });

    it('should reject headers with control characters', () => {
      const badHeaders = { 'control-char': 'value\x00\x01\x02' };
      expect(() => securityValidator.validateRequestHeaders(badHeaders)).toThrow('Only JSON files from Google Takeout are supported.');
    });
  });

  describe('Edge Cases and Attack Vectors', () => {
    it('should handle Unicode normalization attacks', () => {
      const unicodeFilenames = [
        'café.json', // NFC
        'cafe\u0301.json', // NFD
        'test\u200b.json' // Zero-width space
      ];

      unicodeFilenames.forEach(filename => {
        expect(() => securityValidator.validateFilename(filename)).toThrow('Only JSON files from Google Takeout are supported.');
      });
    });

    it('should handle JSON bombs (deeply nested structures)', () => {
      let bomb = {};
      let current = bomb;
      for (let i = 0; i < 50; i++) {
        current.nested = {};
        current = current.nested;
      }

      expect(() => securityValidator.validateJsonStructure(bomb)).toThrow('One or more files contain invalid JSON data.');
    });

    it('should handle malformed JSON with excessive nesting in arrays', () => {
      let nestedArray = [];
      let current = nestedArray;
      for (let i = 0; i < 30; i++) {
        const newArray = [];
        current.push(newArray);
        current = newArray;
      }

      expect(() => securityValidator.validateJsonStructure({ data: nestedArray })).toThrow('One or more files contain invalid JSON data.');
    });

    it('should prevent prototype pollution attempts', () => {
      const pollutionAttempts = [
        { '__proto__': { 'polluted': true } },
        { 'constructor': { 'prototype': { 'polluted': true } } }
      ];

      pollutionAttempts.forEach(attempt => {
        expect(() => securityValidator.validateJsonStructure(attempt)).not.toThrow();
        // Verify no pollution occurred
        expect(Object.prototype.polluted).toBeUndefined();
      });
    });
  });
});