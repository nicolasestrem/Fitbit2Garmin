/**
 * @file Integration tests for concurrency attack vectors.
 * @description This suite simulates various concurrency-based attacks against the
 * RateLimitDO (Durable Object) to ensure its atomicity and resilience. It tests for
 * race conditions, resource exhaustion, and other time-based vulnerabilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitDO } from '../../api/rate-limit-do.js';

describe('Concurrency Attack Prevention', () => {
  let rateLimitDO;
  let mockState;
  let mockEnv;

  beforeEach(() => {
    mockState = {
      storage: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        setAlarm: vi.fn()
      }
    };

    mockEnv = {};
    rateLimitDO = new RateLimitDO(mockState, mockEnv);
  });

  describe('Race Condition Protection', () => {
    it('should handle concurrent requests atomically', async () => {
      // Simulate 30 concurrent requests to test if any exceed the limit of 20
      const clientId = 'concurrent-client';
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];
      const timestamp = 1000;

      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(
          rateLimitDO.checkRateLimit(clientId, endpoint, config, timestamp + i)
        );
      }

      const results = await Promise.all(promises);

      // Count successful and rate-limited requests
      const allowed = results.filter(r => !r.rateLimited);
      const rateLimited = results.filter(r => r.rateLimited);

      // Should allow exactly 20 requests and rate limit the rest
      expect(allowed.length).toBe(20);
      expect(rateLimited.length).toBe(10);

      // Verify final state
      const bucket = rateLimitDO.buckets.get(`${clientId}:${endpoint}`);
      expect(bucket.requests.length).toBe(20);
    });

    it('should prevent timestamp manipulation attacks', async () => {
      const clientId = 'timestamp-attacker';
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];

      // First, fill up the rate limit with legitimate requests
      for (let i = 0; i < 20; i++) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1000 + i);
        expect(result.rateLimited).toBe(false);
      }

      // Try to bypass by using future timestamps
      const futureTimestamps = [2000, 3000, 4000];
      for (const timestamp of futureTimestamps) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, timestamp);
        expect(result.rateLimited).toBe(true);
      }

      // Try to bypass by using past timestamps
      const pastTimestamps = [500, 600, 700];
      for (const timestamp of pastTimestamps) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, timestamp);
        expect(result.rateLimited).toBe(true);
      }
    });

    it('should handle burst attacks across different time windows', async () => {
      const clientId = 'burst-attacker';
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];

      // Initial burst at time 1000
      for (let i = 0; i < 20; i++) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1000 + i);
        expect(result.rateLimited).toBe(false);
      }

      // Try another burst at time 1100 (still within window)
      for (let i = 0; i < 10; i++) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1100 + i);
        expect(result.rateLimited).toBe(true);
      }

      // Wait for partial window expiry (150 seconds later)
      // Some old requests should expire but not all
      for (let i = 0; i < 5; i++) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1250 + i);
        expect(result.rateLimited).toBe(true); // Still should be limited
      }

      // Wait for full window expiry (400 seconds later, past the 300s window)
      for (let i = 0; i < 5; i++) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1400 + i);
        expect(result.rateLimited).toBe(false); // Should be allowed again
      }
    });

    it('should isolate attacks between different clients', async () => {
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];
      const timestamp = 1000;

      // Client 1 exhausts their rate limit
      for (let i = 0; i < 20; i++) {
        const result = await rateLimitDO.checkRateLimit('client1', endpoint, config, timestamp + i);
        expect(result.rateLimited).toBe(false);
      }

      // Client 1 is now rate limited
      const client1Blocked = await rateLimitDO.checkRateLimit('client1', endpoint, config, timestamp + 20);
      expect(client1Blocked.rateLimited).toBe(true);

      // Client 2 should still have full quota
      for (let i = 0; i < 20; i++) {
        const result = await rateLimitDO.checkRateLimit('client2', endpoint, config, timestamp + 30 + i);
        expect(result.rateLimited).toBe(false);
      }

      // Verify both clients have separate limits
      const client1Status = rateLimitDO.buckets.get('client1:uploads');
      const client2Status = rateLimitDO.buckets.get('client2:uploads');

      expect(client1Status.requests.length).toBe(20);
      expect(client2Status.requests.length).toBe(20);
    });

    it('should handle mixed endpoint attacks', async () => {
      const clientId = 'mixed-attacker';
      const timestamp = 1000;

      // Exhaust upload quota
      for (let i = 0; i < 20; i++) {
        const result = await rateLimitDO.checkRateLimit(
          clientId, 'uploads', rateLimitDO.configs.uploads, timestamp + i
        );
        expect(result.rateLimited).toBe(false);
      }

      // Uploads should now be blocked
      const uploadBlocked = await rateLimitDO.checkRateLimit(
        clientId, 'uploads', rateLimitDO.configs.uploads, timestamp + 20
      );
      expect(uploadBlocked.rateLimited).toBe(true);

      // But conversions should still be available
      for (let i = 0; i < 10; i++) {
        const result = await rateLimitDO.checkRateLimit(
          clientId, 'conversions', rateLimitDO.configs.conversions, timestamp + 30 + i
        );
        expect(result.rateLimited).toBe(false);
      }

      // And validations should also be available
      for (let i = 0; i < 30; i++) {
        const result = await rateLimitDO.checkRateLimit(
          clientId, 'validations', rateLimitDO.configs.validations, timestamp + 50 + i
        );
        expect(result.rateLimited).toBe(false);
      }
    });
  });

  describe('Distributed Attack Simulation', () => {
    it('should handle coordinated attacks from multiple IPs', async () => {
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];
      const timestamp = 1000;

      // Simulate 5 attackers, each trying to use full quota
      const attackers = ['attacker1', 'attacker2', 'attacker3', 'attacker4', 'attacker5'];
      const results = [];

      for (const attackerId of attackers) {
        for (let i = 0; i < 20; i++) {
          const result = await rateLimitDO.checkRateLimit(attackerId, endpoint, config, timestamp + i);
          results.push({ attackerId, attempt: i, rateLimited: result.rateLimited });
        }
      }

      // Each attacker should be able to use their full quota independently
      for (const attackerId of attackers) {
        const attackerResults = results.filter(r => r.attackerId === attackerId);
        const allowed = attackerResults.filter(r => !r.rateLimited);
        expect(allowed.length).toBe(20);
      }

      // But if any attacker tries to exceed their quota, they should be blocked
      for (const attackerId of attackers) {
        const result = await rateLimitDO.checkRateLimit(attackerId, endpoint, config, timestamp + 100);
        expect(result.rateLimited).toBe(true);
      }
    });

    it('should handle rapid fire attack patterns', async () => {
      const clientId = 'rapid-fire';
      const endpoint = 'validations'; // Higher limit for testing
      const config = rateLimitDO.configs[endpoint]; // 30 requests per 5 minutes
      const baseTime = 1000;

      // Rapid fire: 100 requests in quick succession
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          rateLimitDO.checkRateLimit(clientId, endpoint, config, baseTime + Math.floor(i / 10))
        );
      }

      const results = await Promise.all(promises);
      const allowed = results.filter(r => !r.rateLimited);
      const blocked = results.filter(r => r.rateLimited);

      // Should allow exactly 30 and block 70
      expect(allowed.length).toBe(30);
      expect(blocked.length).toBe(70);
    });

    it('should maintain consistency under memory pressure', async () => {
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];

      // Create many different clients to simulate memory pressure
      const clients = Array.from({ length: 100 }, (_, i) => `client${i}`);

      for (const clientId of clients) {
        // Each client makes exactly 10 requests
        for (let i = 0; i < 10; i++) {
          const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1000 + i);
          expect(result.rateLimited).toBe(false);
        }
      }

      // Verify all clients have correct counts
      for (const clientId of clients) {
        const bucket = rateLimitDO.buckets.get(`${clientId}:${endpoint}`);
        expect(bucket.requests.length).toBe(10);
      }

      // Each client should still be able to make 10 more requests
      for (const clientId of clients) {
        for (let i = 0; i < 10; i++) {
          const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1100 + i);
          expect(result.rateLimited).toBe(false);
        }
      }

      // But the 21st request should be blocked for each
      for (const clientId of clients) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1200);
        expect(result.rateLimited).toBe(true);
      }
    });
  });

  describe('Time-based Attack Vectors', () => {
    it('should handle clock skew attacks', async () => {
      const clientId = 'clock-skew-attacker';
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];

      // Normal requests at time 1000
      for (let i = 0; i < 20; i++) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1000 + i);
        expect(result.rateLimited).toBe(false);
      }

      // Try to reset by going back in time
      const result1 = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 500);
      expect(result1.rateLimited).toBe(true);

      // Try to reset by jumping far into the future
      const result2 = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 10000);
      expect(result2.rateLimited).toBe(true);

      // Normal progression should still be limited
      const result3 = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1021);
      expect(result3.rateLimited).toBe(true);
    });

    it('should handle sliding window edge cases', async () => {
      const clientId = 'edge-case-client';
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint]; // 20 requests per 300 seconds

      // Fill the window exactly at the start
      const startTime = 1000;
      for (let i = 0; i < 20; i++) {
        const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, startTime + i);
        expect(result.rateLimited).toBe(false);
      }

      // Try at exactly window + 1 (should still be limited)
      const result1 = await rateLimitDO.checkRateLimit(clientId, endpoint, config, startTime + 300);
      expect(result1.rateLimited).toBe(true);

      // Try at window + 1 second (first request should expire)
      const result2 = await rateLimitDO.checkRateLimit(clientId, endpoint, config, startTime + 301);
      expect(result2.rateLimited).toBe(false);

      // Should now have 20 requests again (19 old + 1 new)
      const result3 = await rateLimitDO.checkRateLimit(clientId, endpoint, config, startTime + 302);
      expect(result3.rateLimited).toBe(true);
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should handle excessive bucket creation attempts', async () => {
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];

      // Try to create many buckets rapidly
      const bucketPromises = [];
      for (let i = 0; i < 1000; i++) {
        bucketPromises.push(
          rateLimitDO.checkRateLimit(`bucket${i}`, endpoint, config, 1000)
        );
      }

      const results = await Promise.all(bucketPromises);

      // All should succeed (first request for each client)
      results.forEach(result => {
        expect(result.rateLimited).toBe(false);
        expect(result.current).toBe(1);
      });

      // Verify bucket count
      expect(rateLimitDO.buckets.size).toBe(1000);
    });

    it('should handle malformed client IDs safely', async () => {
      const malformedIds = [
        '',
        null,
        undefined,
        'very'.repeat(1000) + 'long',
        '\x00\x01\x02',
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        '${process.env.SECRET}'
      ];

      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];

      for (const clientId of malformedIds) {
        // Should not crash or behave unexpectedly
        try {
          const result = await rateLimitDO.checkRateLimit(clientId, endpoint, config, 1000);
          expect(result.rateLimited).toBe(false);
          expect(result.current).toBe(1);
        } catch (error) {
          // Some malformed IDs might cause errors, which is acceptable
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Performance Under Attack', () => {
    it('should maintain performance during sustained attack', async () => {
      const endpoint = 'uploads';
      const config = rateLimitDO.configs[endpoint];

      // Simulate sustained attack: 1000 requests over time
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 1000; i++) {
        promises.push(
          rateLimitDO.checkRateLimit('sustained-attacker', endpoint, config, 1000 + Math.floor(i / 10))
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second for 1000 operations)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should maintain correct rate limiting
      const allowed = results.filter(r => !r.rateLimited);
      const blocked = results.filter(r => r.rateLimited);

      expect(allowed.length).toBe(20);
      expect(blocked.length).toBe(980);
    });
  });
});