import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/index.tsx'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Higher coverage for security modules
        'functions/api/rate-limiter.js': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'functions/api/security.js': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'functions/api/error-handler.js': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    }
  }
});