/**
 * Enhanced error handling with specific error types and user-friendly messages
 */

// Error codes for better client-side handling
export const ERROR_CODES = {
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // File validation errors
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_TAKEOUT_FORMAT: 'INVALID_TAKEOUT_FORMAT',

  // Upload/conversion errors
  UPLOAD_NOT_FOUND: 'UPLOAD_NOT_FOUND',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  SDK_UNAVAILABLE: 'SDK_UNAVAILABLE',

  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
};

// User-friendly error messages
const ERROR_MESSAGES = {
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: {
    title: "Too Many Requests",
    message: "You've reached the rate limit. Please wait a moment before trying again.",
    suggestion: "Rate limits help ensure the service remains available for everyone."
  },

  [ERROR_CODES.INVALID_FILE_TYPE]: {
    title: "Invalid File Type",
    message: "Only JSON files from Google Takeout are supported.",
    suggestion: "Please upload .json files from your Fitbit data export."
  },

  [ERROR_CODES.FILE_TOO_LARGE]: {
    title: "File Too Large",
    message: "One or more files exceed the maximum size limit.",
    suggestion: "Try splitting large date ranges into smaller files."
  },

  [ERROR_CODES.TOO_MANY_FILES]: {
    title: "Too Many Files",
    message: "Maximum 3 files can be processed at once.",
    suggestion: "Please select up to 3 files and process additional files separately."
  },

  [ERROR_CODES.INVALID_JSON]: {
    title: "Invalid JSON Format",
    message: "One or more files contain invalid JSON data.",
    suggestion: "Ensure files are valid JSON exports from Google Takeout."
  },

  [ERROR_CODES.INVALID_TAKEOUT_FORMAT]: {
    title: "Invalid Data Format",
    message: "Files don't match the expected Google Takeout weight data format.",
    suggestion: "Please upload weight-YYYY-MM-DD.json files from your Fitbit export."
  },

  [ERROR_CODES.UPLOAD_NOT_FOUND]: {
    title: "Upload Not Found",
    message: "The uploaded files have expired or cannot be found.",
    suggestion: "Please upload your files again."
  },

  [ERROR_CODES.CONVERSION_FAILED]: {
    title: "Conversion Failed",
    message: "Unable to convert your files to Garmin format.",
    suggestion: "Please check your files and try again. Contact support if the problem persists."
  },

  [ERROR_CODES.STORAGE_ERROR]: {
    title: "Storage Error",
    message: "There was a problem accessing file storage.",
    suggestion: "This is a temporary issue. Please try again in a few moments."
  },

  [ERROR_CODES.SDK_UNAVAILABLE]: {
    title: "Conversion Service Unavailable",
    message: "The FIT file conversion service is temporarily unavailable.",
    suggestion: "Please try again later. If the problem persists, contact support."
  },

  [ERROR_CODES.INTERNAL_ERROR]: {
    title: "Internal Server Error",
    message: "An unexpected error occurred while processing your request.",
    suggestion: "Please try again. If the problem persists, contact support."
  },

  [ERROR_CODES.NETWORK_ERROR]: {
    title: "Network Error",
    message: "Unable to connect to the server.",
    suggestion: "Please check your internet connection and try again."
  },

  [ERROR_CODES.TIMEOUT_ERROR]: {
    title: "Request Timeout",
    message: "The request took too long to process.",
    suggestion: "This usually happens with large files. Please try again or use smaller files."
  }
};

export class AppError extends Error {
  constructor(code, details = null, httpStatus = 500) {
    const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
    super(errorInfo.message);

    this.code = code;
    this.title = errorInfo.title;
    this.suggestion = errorInfo.suggestion;
    this.details = details;
    this.httpStatus = httpStatus;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: this.title,
      message: this.message,
      suggestion: this.suggestion,
      error_code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }

  toResponse(corsHeaders = {}) {
    return new Response(JSON.stringify(this.toJSON()), {
      status: this.httpStatus,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// Helper functions for creating specific errors
export const createFileError = (type, filename = null, details = null) => {
  let code, status;

  switch (type) {
    case 'invalid_type':
      code = ERROR_CODES.INVALID_FILE_TYPE;
      status = 400;
      break;
    case 'too_large':
      code = ERROR_CODES.FILE_TOO_LARGE;
      status = 413;
      break;
    case 'invalid_json':
      code = ERROR_CODES.INVALID_JSON;
      status = 400;
      break;
    case 'invalid_format':
      code = ERROR_CODES.INVALID_TAKEOUT_FORMAT;
      status = 422;
      break;
    default:
      code = ERROR_CODES.INTERNAL_ERROR;
      status = 500;
  }

  const errorDetails = filename ? `File: ${filename}` : null;
  const fullDetails = details ? `${errorDetails ? errorDetails + '. ' : ''}${details}` : errorDetails;

  return new AppError(code, fullDetails, status);
};

export const createConversionError = (details = null) => {
  // Detect SDK-specific issues
  const isSdkIssue = details && (
    details.toLowerCase().includes('garmin fit sdk') ||
    details.toLowerCase().includes('fitsdk') ||
    details.toLowerCase().includes('not available in this environment')
  );

  const code = isSdkIssue ? ERROR_CODES.SDK_UNAVAILABLE : ERROR_CODES.CONVERSION_FAILED;
  const status = isSdkIssue ? 503 : 500;

  return new AppError(code, details, status);
};

export const createStorageError = (operation = null, details = null) => {
  const fullDetails = operation ? `Operation: ${operation}. ${details || ''}` : details;
  return new AppError(ERROR_CODES.STORAGE_ERROR, fullDetails, 500);
};

export const createUploadNotFoundError = (uploadId = null) => {
  const details = uploadId ? `Upload ID: ${uploadId}` : null;
  return new AppError(ERROR_CODES.UPLOAD_NOT_FOUND, details, 404);
};

// Enhanced error logging (without exposing sensitive data)
export const logError = (error, context = {}) => {
  const sanitizedContext = {
    endpoint: context.endpoint,
    method: context.method,
    userAgent: context.userAgent,
    timestamp: new Date().toISOString()
  };

  // Don't log sensitive data like file contents, upload IDs in detail, etc.
  console.error('Application Error:', {
    message: error.message,
    code: error.code || 'UNKNOWN',
    context: sanitizedContext,
    stack: error.stack
  });
};

// Partial failure handler for multi-file operations
export class PartialFailureHandler {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  addSuccess(item, result) {
    this.results.push({
      item,
      status: 'success',
      result
    });
  }

  addFailure(item, error) {
    this.errors.push({
      item,
      status: 'failed',
      error: error instanceof AppError ? error.toJSON() : { message: error.message }
    });
  }

  hasFailures() {
    return this.errors.length > 0;
  }

  hasSuccesses() {
    return this.results.length > 0;
  }

  getSuccessfulResults() {
    return this.results.map(r => r.result);
  }

  createResponse(corsHeaders = {}) {
    const totalItems = this.results.length + this.errors.length;
    const successCount = this.results.length;
    const failureCount = this.errors.length;

    if (failureCount === 0) {
      // All succeeded
      return new Response(JSON.stringify({
        success: true,
        message: `All ${successCount} items processed successfully`,
        results: this.getSuccessfulResults()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (successCount === 0) {
      // All failed
      return new Response(JSON.stringify({
        success: false,
        message: `All ${failureCount} items failed to process`,
        errors: this.errors
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // Partial success
      return new Response(JSON.stringify({
        success: false,
        partial_success: true,
        message: `${successCount} of ${totalItems} items processed successfully`,
        results: this.getSuccessfulResults(),
        errors: this.errors
      }), {
        status: 207, // Multi-Status
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}