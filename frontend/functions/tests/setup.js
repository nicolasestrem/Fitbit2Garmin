// Mock Cloudflare Workers environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  },
  writable: true
});

// Mock console methods to reduce noise in tests
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

// Mock Cloudflare environment
global.mockCloudflareEnv = {
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