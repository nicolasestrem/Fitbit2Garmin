import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AppError,
  ERROR_CODES,
  createFileError,
  createConversionError,
  createStorageError,
  createUploadNotFoundError,
  logError,
  PartialFailureHandler
} from '../../api/error-handler.js';

describe('AppError', () => {
  it('should create error with proper structure', () => {
    const error = new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Test details', 429);

    expect(error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
    expect(error.title).toBe('Too Many Requests');
    expect(error.message).toBe("You've reached the rate limit. Please wait a moment before trying again.");
    expect(error.suggestion).toBe('Rate limits help ensure the service remains available for everyone.');
    expect(error.details).toBe('Test details');
    expect(error.httpStatus).toBe(429);
    expect(error.timestamp).toBeDefined();
  });

  it('should default to internal error for unknown codes', () => {
    const error = new AppError('UNKNOWN_CODE', 'Test details');

    expect(error.title).toBe('Internal Server Error');
    expect(error.httpStatus).toBe(500);
  });

  it('should serialize to JSON correctly', () => {
    const error = new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Test details', 400);
    const json = error.toJSON();

    expect(json).toEqual({
      error: 'Invalid File Type',
      message: 'Only JSON files from Google Takeout are supported.',
      suggestion: 'Please upload .json files from your Fitbit data export.',
      error_code: 'INVALID_FILE_TYPE',
      details: 'Test details',
      timestamp: expect.any(String)
    });
  });

  it('should create proper Response object', () => {
    const error = new AppError(ERROR_CODES.FILE_TOO_LARGE, null, 413);
    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    const response = error.toResponse(corsHeaders);

    expect(response.status).toBe(413);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('ERROR_CODES', () => {
  it('should have all required error codes', () => {
    const requiredCodes = [
      'RATE_LIMIT_EXCEEDED',
      'INVALID_FILE_TYPE',
      'FILE_TOO_LARGE',
      'TOO_MANY_FILES',
      'INVALID_JSON',
      'INVALID_TAKEOUT_FORMAT',
      'UPLOAD_NOT_FOUND',
      'CONVERSION_FAILED',
      'STORAGE_ERROR',
      'SDK_UNAVAILABLE',
      'INTERNAL_ERROR',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR'
    ];

    requiredCodes.forEach(code => {
      expect(ERROR_CODES).toHaveProperty(code);
      expect(typeof ERROR_CODES[code]).toBe('string');
    });
  });

  it('should have unique error codes', () => {
    const codes = Object.values(ERROR_CODES);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size);
  });
});

describe('createFileError', () => {
  it('should create invalid type error', () => {
    const error = createFileError('invalid_type', 'test.txt');

    expect(error.code).toBe(ERROR_CODES.INVALID_FILE_TYPE);
    expect(error.httpStatus).toBe(400);
    expect(error.details).toBe('File: test.txt');
  });

  it('should create too large error', () => {
    const error = createFileError('too_large', 'big-file.json', 'Size: 15MB');

    expect(error.code).toBe(ERROR_CODES.FILE_TOO_LARGE);
    expect(error.httpStatus).toBe(413);
    expect(error.details).toBe('File: big-file.json. Size: 15MB');
  });

  it('should create invalid JSON error', () => {
    const error = createFileError('invalid_json', 'malformed.json', 'Unexpected token');

    expect(error.code).toBe(ERROR_CODES.INVALID_JSON);
    expect(error.httpStatus).toBe(400);
    expect(error.details).toBe('File: malformed.json. Unexpected token');
  });

  it('should create invalid format error', () => {
    const error = createFileError('invalid_format', 'wrong-format.json');

    expect(error.code).toBe(ERROR_CODES.INVALID_TAKEOUT_FORMAT);
    expect(error.httpStatus).toBe(422);
  });

  it('should handle unknown file error type', () => {
    const error = createFileError('unknown_type', 'test.json');

    expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(error.httpStatus).toBe(500);
  });

  it('should handle missing filename', () => {
    const error = createFileError('invalid_type', null, 'Additional details');

    expect(error.details).toBe('Additional details');
  });
});

describe('createConversionError', () => {
  it('should create standard conversion error', () => {
    const error = createConversionError('Processing failed');

    expect(error.code).toBe(ERROR_CODES.CONVERSION_FAILED);
    expect(error.httpStatus).toBe(500);
    expect(error.details).toBe('Processing failed');
  });

  it('should detect SDK issues', () => {
    const sdkMessages = [
      'Garmin FIT SDK not available',
      'fitsdk module not found',
      'Encoder not available in this environment'
    ];

    sdkMessages.forEach(message => {
      const error = createConversionError(message);
      expect(error.code).toBe(ERROR_CODES.SDK_UNAVAILABLE);
      expect(error.httpStatus).toBe(503);
    });
  });

  it('should handle null details', () => {
    const error = createConversionError(null);

    expect(error.code).toBe(ERROR_CODES.CONVERSION_FAILED);
    expect(error.details).toBeNull();
  });
});

describe('createStorageError', () => {
  it('should create storage error with operation', () => {
    const error = createStorageError('upload', 'R2 connection failed');

    expect(error.code).toBe(ERROR_CODES.STORAGE_ERROR);
    expect(error.httpStatus).toBe(500);
    expect(error.details).toBe('Operation: upload. R2 connection failed');
  });

  it('should create storage error without operation', () => {
    const error = createStorageError(null, 'General storage failure');

    expect(error.details).toBe('General storage failure');
  });
});

describe('createUploadNotFoundError', () => {
  it('should create upload not found error with ID', () => {
    const error = createUploadNotFoundError('test-upload-123');

    expect(error.code).toBe(ERROR_CODES.UPLOAD_NOT_FOUND);
    expect(error.httpStatus).toBe(404);
    expect(error.details).toBe('Upload ID: test-upload-123');
  });

  it('should create upload not found error without ID', () => {
    const error = createUploadNotFoundError();

    expect(error.code).toBe(ERROR_CODES.UPLOAD_NOT_FOUND);
    expect(error.details).toBeNull();
  });
});

describe('logError', () => {
  it('should log error with sanitized context', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const error = new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Test details');
    const context = {
      endpoint: '/api/upload',
      method: 'POST',
      userAgent: 'Mozilla/5.0',
      sensitiveData: 'secret-key' // Should not be logged
    };

    logError(error, context);

    expect(consoleSpy).toHaveBeenCalledWith('Application Error:', {
      message: error.message,
      code: 'RATE_LIMIT_EXCEEDED',
      context: {
        endpoint: '/api/upload',
        method: 'POST',
        userAgent: 'Mozilla/5.0',
        timestamp: expect.any(String)
      },
      stack: error.stack
    });

    // Ensure sensitive data is not logged
    const loggedCall = consoleSpy.mock.calls[0][1];
    expect(loggedCall.context).not.toHaveProperty('sensitiveData');

    consoleSpy.mockRestore();
  });

  it('should handle errors without code', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const regularError = new Error('Regular error');
    logError(regularError, {});

    expect(consoleSpy).toHaveBeenCalledWith('Application Error:', {
      message: 'Regular error',
      code: 'UNKNOWN',
      context: {
        timestamp: expect.any(String)
      },
      stack: regularError.stack
    });

    consoleSpy.mockRestore();
  });
});

describe('PartialFailureHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new PartialFailureHandler();
  });

  it('should initialize with empty results and errors', () => {
    expect(handler.results).toEqual([]);
    expect(handler.errors).toEqual([]);
    expect(handler.hasFailures()).toBe(false);
    expect(handler.hasSuccesses()).toBe(false);
  });

  it('should add successful results', () => {
    handler.addSuccess('file1.json', { converted: 'file1.fit' });
    handler.addSuccess('file2.json', { converted: 'file2.fit' });

    expect(handler.hasSuccesses()).toBe(true);
    expect(handler.results).toHaveLength(2);
    expect(handler.getSuccessfulResults()).toEqual([
      { converted: 'file1.fit' },
      { converted: 'file2.fit' }
    ]);
  });

  it('should add failures with AppError', () => {
    const appError = new AppError(ERROR_CODES.INVALID_JSON, 'Malformed JSON');
    handler.addFailure('file1.json', appError);

    expect(handler.hasFailures()).toBe(true);
    expect(handler.errors).toHaveLength(1);
    expect(handler.errors[0]).toEqual({
      item: 'file1.json',
      status: 'failed',
      error: appError.toJSON()
    });
  });

  it('should add failures with regular Error', () => {
    const regularError = new Error('Something went wrong');
    handler.addFailure('file1.json', regularError);

    expect(handler.hasFailures()).toBe(true);
    expect(handler.errors[0]).toEqual({
      item: 'file1.json',
      status: 'failed',
      error: { message: 'Something went wrong' }
    });
  });

  describe('createResponse', () => {
    it('should create success response when all items succeed', async () => {
      handler.addSuccess('file1.json', { result: 'success1' });
      handler.addSuccess('file2.json', { result: 'success2' });

      const response = handler.createResponse({ 'Access-Control-Allow-Origin': '*' });

      expect(response.status).toBe(200);

      // Parse response body to verify content
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.message).toContain('2 items processed successfully');
      expect(responseData.results).toHaveLength(2);
    });

    it('should create error response when all items fail', async () => {
      const error1 = new AppError(ERROR_CODES.INVALID_JSON, 'Bad JSON');
      const error2 = new AppError(ERROR_CODES.FILE_TOO_LARGE, 'Too big');

      handler.addFailure('file1.json', error1);
      handler.addFailure('file2.json', error2);

      const response = handler.createResponse();

      expect(response.status).toBe(500);

      const responseData = await response.json();

      expect(responseData.success).toBe(false);
      expect(responseData.message).toContain('2 items failed');
      expect(responseData.errors).toHaveLength(2);
    });

    it('should create partial success response when some items succeed', async () => {
      handler.addSuccess('file1.json', { result: 'success1' });
      handler.addFailure('file2.json', new AppError(ERROR_CODES.INVALID_JSON, 'Bad JSON'));

      const response = handler.createResponse();

      expect(response.status).toBe(207); // Multi-Status

      const responseData = await response.json();

      expect(responseData.success).toBe(false);
      expect(responseData.partial_success).toBe(true);
      expect(responseData.message).toContain('1 of 2 items processed successfully');
      expect(responseData.results).toHaveLength(1);
      expect(responseData.errors).toHaveLength(1);
    });

    it('should include CORS headers in response', () => {
      handler.addSuccess('file1.json', { result: 'success' });

      const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
      const response = handler.createResponse(corsHeaders);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Mixed Success/Failure Scenarios', () => {
    it('should handle complex mixed scenarios', async () => {
      // Add multiple successes
      handler.addSuccess('file1.json', { converted: 'file1.fit', entries: 100 });
      handler.addSuccess('file2.json', { converted: 'file2.fit', entries: 50 });
      handler.addSuccess('file3.json', { converted: 'file3.fit', entries: 75 });

      // Add multiple failures
      handler.addFailure('file4.json', new AppError(ERROR_CODES.INVALID_JSON, 'Malformed'));
      handler.addFailure('file5.json', new AppError(ERROR_CODES.FILE_TOO_LARGE, 'Too big'));

      expect(handler.hasSuccesses()).toBe(true);
      expect(handler.hasFailures()).toBe(true);
      expect(handler.results).toHaveLength(3);
      expect(handler.errors).toHaveLength(2);

      const response = handler.createResponse();
      expect(response.status).toBe(207);

      const responseData = await response.json();

      expect(responseData.partial_success).toBe(true);
      expect(responseData.message).toContain('3 of 5 items processed successfully');
    });

    it('should maintain order of operations', () => {
      handler.addSuccess('first.json', { order: 1 });
      handler.addFailure('second.json', new Error('Failed'));
      handler.addSuccess('third.json', { order: 3 });

      const successResults = handler.getSuccessfulResults();
      expect(successResults[0].order).toBe(1);
      expect(successResults[1].order).toBe(3);

      expect(handler.errors[0].item).toBe('second.json');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty handler', async () => {
      const response = handler.createResponse();

      expect(response.status).toBe(200);

      const responseData = await response.json();

      expect(responseData.message).toContain('0 items processed successfully');
    });

    it('should handle very large number of items', () => {
      // Add 1000 successful items
      for (let i = 0; i < 1000; i++) {
        handler.addSuccess(`file${i}.json`, { id: i });
      }

      expect(handler.hasSuccesses()).toBe(true);
      expect(handler.results).toHaveLength(1000);
      expect(handler.getSuccessfulResults()).toHaveLength(1000);

      const response = handler.createResponse();
      expect(response.status).toBe(200);
    });

    it('should handle null and undefined items gracefully', () => {
      handler.addSuccess(null, { result: 'success' });
      handler.addFailure(undefined, new Error('Failed'));

      expect(handler.hasSuccesses()).toBe(true);
      expect(handler.hasFailures()).toBe(true);
      expect(handler.results[0].item).toBeNull();
      expect(handler.errors[0].item).toBeUndefined();
    });
  });
});