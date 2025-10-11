/**
 * @file Vitest global setup for the frontend test environment.
 * @description This file configures the test environment before any tests run.
 * It sets up the Mock Service Worker (MSW) server to intercept API requests,
 * mocks global objects like `window.location` and `crypto`, and silences
 * console logging during tests to keep the output clean.
 */
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Establish API mocking before all tests.
beforeAll(() => server.listen());

// Reset any request handlers that we may add during the tests
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished
afterAll(() => server.close());

// Mock environment variables
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000'
  },
  writable: true
});

// Mock crypto for UUID generation in tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
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