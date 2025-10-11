/**
 * @file MSW (Mock Service Worker) handlers.
 * @description This file defines the mock API request handlers for use in tests.
 * It uses the Mock Service Worker library to intercept network requests and return
 * mocked responses, allowing for isolated testing of frontend components.
 */
import { http, HttpResponse } from 'msw';

/**
 * An array of request handlers for Mock Service Worker.
 * @type {Array}
 */
export const handlers = [];