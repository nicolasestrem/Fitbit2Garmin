import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onRequest } from '../../api/[[path]].js';

describe('Load Testing and Performance', () => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rate Limiting Under Load', () => {
    it('should handle burst traffic correctly', async () => {
      const burstSize = 25;
      const clientIP = '192.168.1.100';
      const promises = [];

      // Simulate no existing rate limit data
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      // Create burst of concurrent requests
      for (let i = 0; i < burstSize; i++) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': clientIP
          },
          body: JSON.stringify({ data: { request: i } })
        });

        promises.push(onRequest({ request, env: mockEnv, ctx: mockContext }));
      }

      const responses = await Promise.all(promises);

      let successCount = 0;
      let rateLimitedCount = 0;

      responses.forEach(response => {
        if (response.status === 200) successCount++;
        if (response.status === 429) rateLimitedCount++;
      });

      // Should have rate limited most requests in burst
      expect(rateLimitedCount).toBeGreaterThan(burstSize * 0.6); // At least 60% rate limited
      expect(successCount).toBeLessThan(burstSize * 0.4); // Less than 40% successful
    });

    it('should enforce different limits for different endpoints', async () => {
      const clientIP = '192.168.1.101';
      const now = Math.floor(Date.now() / 1000);

      // Mock existing requests at upload limit (20 requests in 5 minutes)
      const uploadRequests = Array.from({ length: 19 }, (_, i) => now - (i * 10));

      // Mock existing requests below conversion limit (5 requests in 1 hour)
      const conversionRequests = Array.from({ length: 5 }, (_, i) => now - (i * 600));

      mockEnv.RATE_LIMITS.get
        .mockImplementation((key) => {
          if (key.includes('uploads')) {
            return Promise.resolve(JSON.stringify({
              requests: uploadRequests,
              lastUpdate: now
            }));
          } else if (key.includes('conversions')) {
            return Promise.resolve(JSON.stringify({
              requests: conversionRequests,
              lastUpdate: now
            }));
          }
          return Promise.resolve(null);
        });

      // Test upload endpoint (should allow 1 more)
      const uploadRequest = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: new FormData(),
        headers: {
          'cf-connecting-ip': clientIP
        }
      });

      const uploadResponse = await onRequest({ request: uploadRequest, env: mockEnv, ctx: mockContext });
      expect(uploadResponse.status).toBe(200); // Should allow one more

      // Test conversion endpoint (should allow more)
      const conversionRequest = new Request('https://example.com/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': clientIP
        },
        body: JSON.stringify({ uploadId: 'test-123' })
      });

      const conversionResponse = await onRequest({ request: conversionRequest, env: mockEnv, ctx: mockContext });
      expect([200, 404]).toContain(conversionResponse.status); // Should allow (404 for missing upload is OK)
    });

    it('should handle sustained load over time windows', async () => {
      const clientIP = '192.168.1.102';
      const results = {
        allowed: 0,
        rateLimited: 0,
        errors: 0
      };

      // Simulate requests over time
      for (let minute = 0; minute < 10; minute++) {
        const now = Math.floor(Date.now() / 1000) - (minute * 60);

        // Create realistic traffic pattern (2-3 requests per minute)
        const requestsThisMinute = Math.floor(Math.random() * 2) + 2;

        for (let req = 0; req < requestsThisMinute; req++) {
          // Mock rate limit data to simulate accumulating requests
          const existingRequests = Array.from({ length: minute * 2 }, (_, i) => now - (i * 30));

          mockEnv.RATE_LIMITS.get.mockResolvedValue(JSON.stringify({
            requests: existingRequests,
            lastUpdate: now
          }));

          const request = new Request('https://example.com/api/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'cf-connecting-ip': clientIP
            },
            body: JSON.stringify({ data: { minute, request: req } })
          });

          try {
            const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

            if (response.status === 200) results.allowed++;
            else if (response.status === 429) results.rateLimited++;
            else results.errors++;
          } catch (error) {
            results.errors++;
          }
        }
      }

      // Should have processed some requests and rate limited others
      expect(results.allowed).toBeGreaterThan(0);
      expect(results.rateLimited).toBeGreaterThan(0);
      expect(results.errors).toBe(0); // No unexpected errors
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle large file uploads efficiently', async () => {
      const clientIP = '192.168.1.103';

      // Create a large but valid JSON file (close to 10MB limit)
      const largeData = {
        activities: Array(5000).fill({
          id: 'activity-' + Math.random(),
          name: 'Large Activity Data Set',
          data: 'x'.repeat(1000) // 1KB of data per activity
        })
      };

      const largeFile = new File([JSON.stringify(largeData)], 'large-export.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('files', largeFile);

      const request = new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'cf-connecting-ip': clientIP
        }
      });

      // Mock rate limiting to allow
      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);
      mockEnv.FILE_STORAGE.put.mockResolvedValue();

      const startTime = Date.now();
      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });
      const endTime = Date.now();

      // Should process within reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect([200, 413]).toContain(response.status); // Success or file too large
    });

    it('should handle multiple concurrent large requests', async () => {
      const numConcurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < numConcurrentRequests; i++) {
        const data = {
          activities: Array(1000).fill({
            id: `activity-${i}-${Math.random()}`,
            data: 'x'.repeat(500)
          })
        };

        const file = new File([JSON.stringify(data)], `concurrent-${i}.json`, {
          type: 'application/json'
        });

        const formData = new FormData();
        formData.append('files', file);

        const request = new Request('https://example.com/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'cf-connecting-ip': `192.168.1.${110 + i}`
          }
        });

        // Mock rate limiting and storage
        mockEnv.RATE_LIMITS.get.mockResolvedValue(null);
        mockEnv.FILE_STORAGE.put.mockResolvedValue();

        promises.push(onRequest({ request, env: mockEnv, ctx: mockContext }));
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Should handle all concurrent requests
      expect(responses).toHaveLength(numConcurrentRequests);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);

      // All should succeed or be rate limited
      responses.forEach(response => {
        expect([200, 413, 429]).toContain(response.status);
      });
    });
  });

  describe('Error Recovery Under Load', () => {
    it('should recover gracefully from storage failures', async () => {
      const clientIP = '192.168.1.104';
      let storageFailureCount = 0;
      let successCount = 0;

      // Mock intermittent storage failures
      mockEnv.FILE_STORAGE.put.mockImplementation(() => {
        if (Math.random() < 0.3) { // 30% failure rate
          storageFailureCount++;
          return Promise.reject(new Error('Storage temporarily unavailable'));
        } else {
          successCount++;
          return Promise.resolve();
        }
      });

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const requests = [];
      for (let i = 0; i < 20; i++) {
        const file = new File([`{"test": ${i}}`], `test-${i}.json`, {
          type: 'application/json'
        });

        const formData = new FormData();
        formData.append('files', file);

        const request = new Request('https://example.com/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'cf-connecting-ip': clientIP
          }
        });

        requests.push(onRequest({ request, env: mockEnv, ctx: mockContext }));
      }

      const responses = await Promise.all(requests);

      let apiSuccesses = 0;
      let apiFailures = 0;

      responses.forEach(response => {
        if (response.status === 200) apiSuccesses++;
        else if (response.status === 500) apiFailures++;
      });

      // Should have handled both successes and failures appropriately
      expect(apiSuccesses).toBeGreaterThan(0);
      expect(apiFailures).toBeGreaterThan(0);
      expect(storageFailureCount).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);
    });

    it('should handle KV store failures gracefully', async () => {
      const clientIP = '192.168.1.105';
      let kvFailureCount = 0;

      // Mock KV failures (should fail open)
      mockEnv.RATE_LIMITS.get.mockImplementation(() => {
        kvFailureCount++;
        return Promise.reject(new Error('KV store unavailable'));
      });

      mockEnv.FILE_STORAGE.put.mockResolvedValue();

      const requests = [];
      for (let i = 0; i < 10; i++) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': clientIP
          },
          body: JSON.stringify({ data: { test: i } })
        });

        requests.push(onRequest({ request, env: mockEnv, ctx: mockContext }));
      }

      const responses = await Promise.all(requests);

      // Should fail open - allow all requests when KV is down
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(kvFailureCount).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process small requests quickly', async () => {
      const clientIP = '192.168.1.106';

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      const request = new Request('https://example.com/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': clientIP
        },
        body: JSON.stringify({ data: { simple: 'test' } })
      });

      const startTime = Date.now();
      const response = await onRequest({ request, env: mockEnv, ctx: mockContext });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should maintain consistent performance under steady load', async () => {
      const clientIP = '192.168.1.107';
      const responseTimes = [];

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);

      // Test steady stream of requests
      for (let i = 0; i < 50; i++) {
        const request = new Request('https://example.com/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': clientIP
          },
          body: JSON.stringify({ data: { request: i } })
        });

        const startTime = Date.now();
        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });
        const endTime = Date.now();

        expect(response.status).toBe(200);
        responseTimes.push(endTime - startTime);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Calculate performance metrics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      // Performance should be consistent
      expect(avgResponseTime).toBeLessThan(200); // Average < 200ms
      expect(maxResponseTime).toBeLessThan(500); // No request > 500ms
      expect(maxResponseTime - minResponseTime).toBeLessThan(300); // Consistent performance
    });
  });

  describe('Resource Cleanup', () => {
    it('should properly clean up resources after requests', async () => {
      const clientIP = '192.168.1.108';

      mockEnv.RATE_LIMITS.get.mockResolvedValue(null);
      mockEnv.FILE_STORAGE.put.mockResolvedValue();

      // Process multiple requests with different types
      const requestTypes = [
        { endpoint: '/api/validate', method: 'POST', body: JSON.stringify({ data: { test: 'cleanup1' } }) },
        { endpoint: '/api/upload', method: 'POST', body: (() => {
          const fd = new FormData();
          fd.append('files', new File(['{"test": "cleanup2"}'], 'test.json', { type: 'application/json' }));
          return fd;
        })() },
        { endpoint: '/api/convert', method: 'POST', body: JSON.stringify({ uploadId: 'cleanup-test' }) },
        { endpoint: '/api/download/cleanup.fit', method: 'GET', body: null }
      ];

      for (const reqType of requestTypes) {
        const request = new Request(`https://example.com${reqType.endpoint}`, {
          method: reqType.method,
          headers: {
            'Content-Type': reqType.endpoint === '/api/upload' ? undefined : 'application/json',
            'cf-connecting-ip': clientIP
          },
          body: reqType.body
        });

        const response = await onRequest({ request, env: mockEnv, ctx: mockContext });

        // Should handle all request types
        expect([200, 404, 400]).toContain(response.status);
      }

      // Verify cleanup calls
      expect(mockContext.waitUntil).toHaveBeenCalled();
    });
  });
});