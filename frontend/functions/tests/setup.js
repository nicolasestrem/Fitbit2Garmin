/**
 * @file Vitest global setup file.
 * @description This file configures the test environment before any tests are run.
 * It mocks global objects and functions that are specific to the Cloudflare Workers
 * environment, such as `crypto.randomUUID` and the Cloudflare environment bindings
 * (KV, R2). It also mocks console methods to reduce noise during test runs.
 */

// Mock the global `crypto` object, which is available in Cloudflare Workers
// but not in a standard Node.js test environment.
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  },
  writable: true
});

// Mock console methods to prevent them from polluting the test output.
// This is useful for tests that are expected to log errors or warnings.
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Create a global mock of the Cloudflare environment bindings.
// This allows tests to easily access and mock KV and R2 storage operations.
global.mockCloudflareEnv = {
  RATE_LIMITS: { // Mock for KV namespace
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  FILE_STORAGE: { // Mock for R2 bucket
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
};