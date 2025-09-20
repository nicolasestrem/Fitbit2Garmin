import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onRequest } from '../../api/[[path]].js';
import { createFileError } from '../../api/error-handler.js';

describe('API Endpoints Integration Tests', () => {
  let mockEnv;
  let mockContext;

  beforeEach(() => {
    mockEnv = {
      RATE_LIMITS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      },
      FILE_STORAGE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };

    mockContext = {
      waitUntil: vi.fn()
    };

    // Mock fetch for external API calls
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS Preflight Requests', () => {
    it('should handle OPTIONS requests with correct CORS headers', async () => {
      const request = new Request('https://example.com/api/upload', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://fitbit2garmin.app',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type'
        }
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('content-type');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should handle preflight for all supported endpoints', async () => {
      const endpoints = ['/api/upload', '/api/convert', '/api/validate', '/api/download'];

      for (const endpoint of endpoints) {
        const request = new Request(`https://example.com${endpoint}`, {
          method: 'OPTIONS'
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Upload Endpoint', () => {
    it('should handle valid file upload', async () => {
      const testFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', testFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: [],
        lastUpdate: Math.floor(Date.now() / 1000)
      }));

      // Mock file storage
      mockEnv.FILE_STORAGE.put.mockResolvedValue();

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.uploadId).toBeDefined();
      expect(responseData.files).toHaveLength(1);
    });

    it('should enforce rate limiting on uploads', async () => {
      const testFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', testFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock rate limiting to trigger limit
      const now = Math.floor(Date.now() / 1000);
      const existingRequests = Array.from({ length: 20 }, (_, i) => now - (i * 10));
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();

      const responseData = await response.json();
      expect(responseData.error_code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should reject files that are too large', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const largeFile = new File([largeContent], 'large.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', largeFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(413);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('FILE_TOO_LARGE');
    });

    it('should reject too many files', async () => {
      const formData = new FormData();

      // Add 4 files (exceeds limit of 3)
      for (let i = 0; i < 4; i++) {
        const file = new File([`{"file": ${i}}`], `file${i}.json`, {
          type: 'application/json'
        });
        formData.append('files', file);
      }

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('TOO_MANY_FILES');
    });

    it('should reject invalid file types', async () => {
      const textFile = new File(['plain text'], 'test.txt', {
        type: 'text/plain'
      });

      const formData = new FormData();
      formData.append('files', textFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('INVALID_FILE_TYPE');
    });

    it('should handle malicious filenames', async () => {
      const maliciousFile = new File(['{"test": "data"}'], '../../../etc/passwd', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', maliciousFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('INVALID_FILE_TYPE');
    });

    it('should handle storage errors gracefully', async () => {
      const testFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', testFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      // Mock storage failure
      mockEnv.FILE_STORAGE.put.mockRejectedValue(new Error('Storage unavailable'));

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(500);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('STORAGE_ERROR');
    });
  });

  describe('Validate Endpoint', () => {
    it('should validate valid Fitbit takeout format', async () => {
      const validFitbitData = {
        activities: [
          {
            logId: 123,
            activityName: "Running",
            startTime: "2023-01-01 10:00:00",
            duration: 1800000,
            distance: 5.0,
            calories: 300
          }
        ]
      };

      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ data: validFitbitData })
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.valid).toBe(true);
      expect(responseData.format).toBe('fitbit_takeout');
    });

    it('should reject malformed JSON in validation', async () => {
      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: '{"invalid": json}'
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('INVALID_JSON');
    });

    it('should detect JSON bomb attacks', async () => {
      // Create a deeply nested JSON structure
      let deepJson = {};
      let current = deepJson;
      for (let i = 0; i < 50; i++) {
        current.nested = {};
        current = current.nested;
      }

      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ data: deepJson })
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('INVALID_JSON');
    });

    it('should enforce rate limiting on validation', async () => {
      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ data: { test: 'data' } })
      });

      // Mock rate limiting to trigger limit
      const now = Math.floor(Date.now() / 1000);
      const existingRequests = Array.from({ length: 10 }, (_, i) => now - (i * 100));
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();
    });
  });

  describe('Convert Endpoint', () => {
    beforeEach(() => {
      // Mock successful file retrieval
      mockEnv.FILE_STORAGE.get.mockResolvedValue({
        body: JSON.stringify({
          "Physical Activities": [
            {
              "logId": 123,
              "activityName": "Running",
              "startTime": "2023-01-01 10:00:00",
              "duration": 1800000,
              "distance": 5.0,
              "calories": 300
            }
          ]
        })
      });
    });

    it('should convert valid upload successfully', async () => {
      const request = new Request('https://example.com/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ uploadId: 'test-upload-123' })
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.convertedFiles).toBeDefined();
    });

    it('should handle upload not found', async () => {
      const request = new Request('https://example.com/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ uploadId: 'nonexistent-upload' })
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      // Mock upload not found
      mockEnv.FILE_STORAGE.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(404);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('UPLOAD_NOT_FOUND');
    });

    it('should handle partial conversion failures', async () => {
      // Mock mixed file scenario - some valid, some invalid
      mockEnv.FILE_STORAGE.get
        .mockResolvedValueOnce({
          body: JSON.stringify({
            "Physical Activities": [
              {
                "logId": 123,
                "activityName": "Running",
                "startTime": "2023-01-01 10:00:00",
                "duration": 1800000
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          body: '{"invalid": "format"}'
        });

      const request = new Request('https://example.com/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ uploadId: 'test-upload-mixed' })
      });

      // Mock rate limiting to allow request
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(207); // Multi-Status for partial success

      const responseData = await response.json();
      expect(responseData.partial_success).toBe(true);
      expect(responseData.results).toBeDefined();
      expect(responseData.errors).toBeDefined();
    });

    it('should enforce rate limiting on conversions', async () => {
      const request = new Request('https://example.com/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ uploadId: 'test-upload-123' })
      });

      // Mock rate limiting to trigger limit
      const now = Math.floor(Date.now() / 1000);
      const existingRequests = Array.from({ length: 10 }, (_, i) => now - (i * 100));
      mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
        requests: existingRequests,
        lastUpdate: now
      }));

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();
    });
  });

  describe('Download Endpoint', () => {
    it('should download converted file successfully', async () => {
      const mockFitFile = new Uint8Array([0x0E, 0x10, 0x0C, 0x01]); // Mock FIT file header

      const request = new Request('https://example.com/api/download/test-file-123.fit', {
        method: 'GET',
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock file retrieval
      mockEnv.FILE_STORAGE.get.mockResolvedValue({
        body: mockFitFile
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
    });

    it('should handle file not found', async () => {
      const request = new Request('https://example.com/api/download/nonexistent.fit', {
        method: 'GET',
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock file not found
      mockEnv.FILE_STORAGE.get.mockResolvedValue(null);

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(404);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('UPLOAD_NOT_FOUND');
    });

    it('should sanitize malicious download filenames', async () => {
      const request = new Request('https://example.com/api/download/../../../etc/passwd', {
        method: 'GET',
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('INVALID_FILE_TYPE');
    });
  });

  describe('Unsupported Methods and Endpoints', () => {
    it('should return 405 for unsupported HTTP methods', async () => {
      const request = new Request('https://example.com/api/upload', {
        method: 'PUT',
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toContain('POST');
    });

    it('should return 404 for unknown endpoints', async () => {
      const request = new Request('https://example.com/api/unknown-endpoint', {
        method: 'GET',
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(404);
    });

    it('should handle malformed request paths', async () => {
      const request = new Request('https://example.com/api/../../../admin', {
        method: 'GET',
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(404);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle KV storage failures gracefully', async () => {
      const testFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', testFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      // Mock KV failure (should fail open for rate limiting)
      mockEnv.RATE_LIMITS.get.mockRejectedValue(new Error('KV unavailable'));
      mockEnv.FILE_STORAGE.put.mockResolvedValue();

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      // Should proceed despite rate limiting failure (fail open)
      expect(response.status).toBe(200);
    });

    it('should handle concurrent requests to same endpoint', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': `192.168.1.${i}`
          },
          body: JSON.stringify({ data: { test: 'data' } })
        });

        // Mock rate limiting to allow all requests
        mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

        promises.push(onRequest({ request, env: mockEnv, ctx: mockContext }));
      }

      const responses = await Promise.all(promises);

      // All requests should be processed
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // Either success or rate limited
      });
    });
  });
});