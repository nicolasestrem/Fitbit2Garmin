/**
 * @file Enhanced error handling module.
 * @description Provides a structured approach to error management with specific error types,
 * user-friendly messages, and helper classes for handling partial failures.
 */

/**
 * A collection of standardized error codes for consistent client-side handling.
 * @const {object}
 */
export const ERROR_CODES = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_TAKEOUT_FORMAT: 'INVALID_TAKEOUT_FORMAT',
  UPLOAD_NOT_FOUND: 'UPLOAD_NOT_FOUND',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  SDK_UNAVAILABLE: 'SDK_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
};

/**
 * A map of error codes to user-friendly messages and suggestions.
 * @const {object}
 */
const ERROR_MESSAGES = {
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: { title: "Too Many Requests", message: "You've reached the rate limit. Please wait a moment before trying again.", suggestion: "Rate limits help ensure the service remains available for everyone." },
  [ERROR_CODES.INVALID_FILE_TYPE]: { title: "Invalid File Type", message: "Only JSON files from Google Takeout are supported.", suggestion: "Please upload .json files from your Fitbit data export." },
  [ERROR_CODES.FILE_TOO_LARGE]: { title: "File Too Large", message: "One or more files exceed the maximum size limit.", suggestion: "Try splitting large date ranges into smaller files." },
  [ERROR_CODES.TOO_MANY_FILES]: { title: "Too Many Files", message: "Maximum 3 files can be processed at once.", suggestion: "Please select up to 3 files and process additional files separately." },
  [ERROR_CODES.INVALID_JSON]: { title: "Invalid JSON Format", message: "One or more files contain invalid JSON data.", suggestion: "Ensure files are valid JSON exports from Google Takeout." },
  [ERROR_CODES.INVALID_TAKEOUT_FORMAT]: { title: "Invalid Data Format", message: "Files don't match the expected Google Takeout weight data format.", suggestion: "Please upload weight-YYYY-MM-DD.json files from your Fitbit export." },
  [ERROR_CODES.UPLOAD_NOT_FOUND]: { title: "Upload Not Found", message: "The uploaded files have expired or cannot be found.", suggestion: "Please upload your files again." },
  [ERROR_CODES.CONVERSION_FAILED]: { title: "Conversion Failed", message: "Unable to convert your files to Garmin format.", suggestion: "Please check your files and try again. Contact support if the problem persists." },
  [ERROR_CODES.STORAGE_ERROR]: { title: "Storage Error", message: "There was a problem accessing file storage.", suggestion: "This is a temporary issue. Please try again in a few moments." },
  [ERROR_CODES.SDK_UNAVAILABLE]: { title: "Conversion Service Unavailable", message: "The FIT file conversion service is temporarily unavailable.", suggestion: "Please try again later. If the problem persists, contact support." },
  [ERROR_CODES.INTERNAL_ERROR]: { title: "Internal Server Error", message: "An unexpected error occurred while processing your request.", suggestion: "Please try again. If the problem persists, contact support." },
  [ERROR_CODES.NETWORK_ERROR]: { title: "Network Error", message: "Unable to connect to the server.", suggestion: "Please check your internet connection and try again." },
  [ERROR_CODES.TIMEOUT_ERROR]: { title: "Request Timeout", message: "The request took too long to process.", suggestion: "This usually happens with large files. Please try again or use smaller files." }
};

/**
 * Custom error class for application-specific errors.
 * It includes a structured format for consistent error responses.
 */
export class AppError extends Error {
  /**
   * Creates an instance of AppError.
   * @param {string} code - The error code from ERROR_CODES.
   * @param {any} [details=null] - Additional details about the error.
   * @param {number} [httpStatus=500] - The HTTP status code to associate with the error.
   */
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

  /**
   * Converts the error to a JSON object suitable for an API response.
   * @returns {object} A JSON representation of the error.
   */
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

  /**
   * Creates a Response object from the error.
   * @param {object} [corsHeaders={}] - CORS headers to include in the response.
   * @returns {Response} A Response object representing the error.
   */
  toResponse(corsHeaders = {}) {
    return new Response(JSON.stringify(this.toJSON()), {
      status: this.httpStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Creates a file-related AppError.
 * @param {'invalid_type' | 'too_large' | 'invalid_json' | 'invalid_format'} type - The type of file error.
 * @param {string|null} [filename=null] - The name of the file that caused the error.
 * @param {any} [details=null] - Additional error details.
 * @returns {AppError} A new AppError instance.
 */
export const createFileError = (type, filename = null, details = null) => {
  let code, status;
  switch (type) {
    case 'invalid_type': code = ERROR_CODES.INVALID_FILE_TYPE; status = 400; break;
    case 'too_large': code = ERROR_CODES.FILE_TOO_LARGE; status = 413; break;
    case 'invalid_json': code = ERROR_CODES.INVALID_JSON; status = 400; break;
    case 'invalid_format': code = ERROR_CODES.INVALID_TAKEOUT_FORMAT; status = 422; break;
    default: code = ERROR_CODES.INTERNAL_ERROR; status = 500;
  }
  const errorDetails = filename ? `File: ${filename}` : null;
  const fullDetails = details ? `${errorDetails ? errorDetails + '. ' : ''}${details}` : errorDetails;
  return new AppError(code, fullDetails, status);
};

/**
 * Creates a conversion-related AppError, detecting if the issue is with the FIT SDK.
 * @param {any} [details=null] - Details about the conversion error.
 * @returns {AppError} A new AppError instance.
 */
export const createConversionError = (details = null) => {
  const isSdkIssue = details && (details.toLowerCase().includes('garmin fit sdk') || details.toLowerCase().includes('fitsdk') || details.toLowerCase().includes('not available in this environment'));
  const code = isSdkIssue ? ERROR_CODES.SDK_UNAVAILABLE : ERROR_CODES.CONVERSION_FAILED;
  const status = isSdkIssue ? 503 : 500;
  return new AppError(code, details, status);
};

/**
 * Creates a storage-related AppError.
 * @param {string|null} [operation=null] - The storage operation that failed (e.g., 'upload').
 * @param {any} [details=null] - Additional error details.
 * @returns {AppError} A new AppError instance.
 */
export const createStorageError = (operation = null, details = null) => {
  const fullDetails = operation ? `Operation: ${operation}. ${details || ''}` : details;
  return new AppError(ERROR_CODES.STORAGE_ERROR, fullDetails, 500);
};

/**
 * Creates an AppError for a non-existent upload.
 * @param {string|null} [uploadId=null] - The upload ID that was not found.
 * @returns {AppError} A new AppError instance.
 */
export const createUploadNotFoundError = (uploadId = null) => {
  const details = uploadId ? `Upload ID: ${uploadId}` : null;
  return new AppError(ERROR_CODES.UPLOAD_NOT_FOUND, details, 404);
};

/**
 * Logs an error with sanitized context, avoiding exposure of sensitive data.
 * @param {Error} error - The error object to log.
 * @param {object} [context={}] - The context in which the error occurred (e.g., endpoint, method).
 */
export const logError = (error, context = {}) => {
  const sanitizedContext = {
    endpoint: context.endpoint,
    method: context.method,
    userAgent: context.userAgent,
    timestamp: new Date().toISOString()
  };
  console.error('Application Error:', {
    message: error.message,
    code: error.code || 'UNKNOWN',
    context: sanitizedContext,
    stack: error.stack
  });
};

/**
 * A handler for operations that can have partial failures, like batch file processing.
 * It tracks successes and failures separately.
 */
export class PartialFailureHandler {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  /**
   * Adds a success record.
   * @param {string} item - The identifier of the item that succeeded.
   * @param {any} result - The result of the successful operation.
   */
  addSuccess(item, result) {
    this.results.push({ item, status: 'success', result });
  }

  /**
   * Adds a failure record.
   * @param {string} item - The identifier of the item that failed.
   * @param {Error} error - The error object associated with the failure.
   */
  addFailure(item, error) {
    this.errors.push({
      item,
      status: 'failed',
      error: error instanceof AppError ? error.toJSON() : { message: error.message }
    });
  }

  /**
   * Checks if there were any failures.
   * @returns {boolean} True if there are failures, false otherwise.
   */
  hasFailures() {
    return this.errors.length > 0;
  }

  /**
   * Checks if there were any successes.
   * @returns {boolean} True if there are successes, false otherwise.
   */
  hasSuccesses() {
    return this.results.length > 0;
  }

  /**
   * Gets an array of the successful results.
   * @returns {Array<any>} An array of the results from successful operations.
   */
  getSuccessfulResults() {
    return this.results.map(r => r.result);
  }

  /**
   * Creates a Response object that reflects the overall state (full success, partial success, or full failure).
   * @param {object} [corsHeaders={}] - CORS headers to include in the response.
   * @returns {Response} A Response object summarizing the outcome.
   */
  createResponse(corsHeaders = {}) {
    const totalItems = this.results.length + this.errors.length;
    const successCount = this.results.length;
    const failureCount = this.errors.length;

    if (failureCount === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: `All ${successCount} items processed successfully`,
        results: this.getSuccessfulResults()
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (successCount === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: `All ${failureCount} items failed to process`,
        errors: this.errors
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({
        success: false,
        partial_success: true,
        message: `${successCount} of ${totalItems} items processed successfully`,
        results: this.getSuccessfulResults(),
        errors: this.errors
      }), { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
}