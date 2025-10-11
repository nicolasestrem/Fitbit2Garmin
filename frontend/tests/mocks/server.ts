/**
 * @file MSW (Mock Service Worker) server setup.
 * @description This file configures and exports a mock server using MSW.
 * This server is used in the Node.js test environment (Vitest) to intercept
 * API requests and respond with mocked data defined in the handlers.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The MSW mock server instance, configured with the defined request handlers.
 * @type {import('msw/node').SetupServer}
 */
export const server = setupServer(...handlers);