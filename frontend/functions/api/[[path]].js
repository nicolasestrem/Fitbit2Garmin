/**
 * Cloudflare Pages Function to handle API routes
 * This replaces the FastAPI backend with proper R2 storage
 */

import { RateLimiter } from './rate-limiter.js';
import {
  AppError,
  ERROR_CODES,
  createFileError,
  createConversionError,
  createStorageError,
  createUploadNotFoundError,
  logError,
  PartialFailureHandler
} from './error-handler.js';
import { SecurityValidator } from './security.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Initialize security and rate limiting
  const rateLimiter = new RateLimiter(env);
  const securityValidator = new SecurityValidator(env);

  // Add CORS and security headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  const secureHeaders = securityValidator.addSecurityHeaders(corsHeaders);

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: secureHeaders,
    });
  }

  try {
    // Security checks
    securityValidator.validateRequestHeaders(request);
    await securityValidator.isClientBlocked(request);
    await securityValidator.checkSuspiciousActivity(request);
    // Basic routing
    if (pathname.startsWith('/api/usage/')) {
      return handleUsage(request, env, corsHeaders);
    } else if (pathname === '/api/upload') {
      return handleUpload(request, env, secureHeaders, rateLimiter, securityValidator);
    } else if (pathname === '/api/validate') {
      return handleValidate(request, env, secureHeaders, rateLimiter, securityValidator);
    } else if (pathname === '/api/convert') {
      return handleConvert(request, env, secureHeaders, rateLimiter, securityValidator);
    } else if (pathname.startsWith('/api/download/')) {
      return handleDownload(request, env, corsHeaders);
    } else if (pathname === '/api/' || pathname === '/api') {
      return new Response(JSON.stringify({
        message: "Fitbit to Garmin Converter API",
        status: "running",
        version: "1.0.0",
        platform: "Cloudflare Pages Functions"
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: "Not Found",
      message: `Route ${pathname} not found`
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // Enhanced error logging
    logError(error, {
      endpoint: pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')
    });

    // Return structured error response
    if (error instanceof AppError) {
      return error.toResponse(corsHeaders);
    }

    // Handle unexpected errors
    const unexpectedError = new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
    return unexpectedError.toResponse(corsHeaders);
  }
}

async function handleUsage(request, env, corsHeaders) {
  // Extract fingerprint hash from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const fingerprintHash = pathParts[pathParts.length - 1];

  if (!fingerprintHash || fingerprintHash === 'usage') {
    return new Response(JSON.stringify({
      error: "Fingerprint hash required"
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // For now, return mock data since fingerprint requirements are removed
  const usageData = {
    conversions_used: 0,
    conversions_limit: 99999,
    time_until_reset: 86400, // 24 hours in seconds
    can_convert: true
  };

  return new Response(JSON.stringify(usageData), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpload(request, env, corsHeaders, rateLimiter, securityValidator) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check upload rate limit
  const rateLimitResult = await rateLimiter.checkRateLimit(request, 'uploads');
  if (rateLimitResult?.rateLimited) {
    return rateLimiter.createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files');

    // Validate files using rate limiter
    const fileValidation = rateLimiter.validateFiles(files);
    if (!fileValidation.valid) {
      if (files.length > 3) {
        throw new AppError(ERROR_CODES.TOO_MANY_FILES, null, 400);
      } else {
        throw createFileError('too_large', null, fileValidation.error);
      }
    }

    if (files.length === 0) {
      throw createFileError('invalid_type', null, 'No files provided');
    }

    // Generate upload ID
    const uploadId = crypto.randomUUID();
    const fileData = [];

    // Process each file with security validation
    for (const file of files) {
      // Validate filename
      const sanitizedFilename = securityValidator.validateFilename(file.name);

      if (!sanitizedFilename.endsWith('.json')) {
        throw createFileError('invalid_type', sanitizedFilename);
      }

      // Read and validate content
      const content = await file.text();
      try {
        // Security validation of content and JSON structure
        const jsonData = securityValidator.validateFileContent(content, sanitizedFilename);

        // Validate Google Takeout format with security checks
        securityValidator.validateGoogleTakeoutFormat(jsonData, sanitizedFilename);

        fileData.push({
          filename: sanitizedFilename,
          data: jsonData
        });

        // Store file in R2
        try {
          await env.FILE_STORAGE.put(`uploads/${uploadId}/${sanitizedFilename}`, content, {
            httpMetadata: {
              contentType: 'application/json'
            }
          });
        } catch (storageError) {
          throw createStorageError('upload', `Failed to store ${sanitizedFilename}: ${storageError.message}`);
        }
      } catch (validationError) {
        if (validationError instanceof AppError) {
          throw validationError;
        }
        throw createFileError('invalid_json', sanitizedFilename, validationError.message);
      }
    }

    // Store metadata in KV
    try {
      await env.RATE_LIMITS.put(`upload:${uploadId}`, JSON.stringify({
        files: fileData.map(f => ({ filename: f.filename, size: JSON.stringify(f.data).length })),
        timestamp: Date.now(),
        status: 'uploaded'
      }), { expirationTtl: 3600 }); // 1 hour expiration
    } catch (kvError) {
      throw createStorageError('metadata', `Failed to store upload metadata: ${kvError.message}`);
    }

    return new Response(JSON.stringify({
      upload_id: uploadId,
      files_received: files.length,
      message: `Successfully uploaded ${files.length} files`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // Re-throw AppErrors to be handled by main error handler
    if (error instanceof AppError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, `Upload failed: ${error.message}`);
  }
}

async function handleValidate(request, env, corsHeaders, rateLimiter, securityValidator) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { upload_id } = await request.json();

    if (!upload_id) {
      return new Response(JSON.stringify({
        error: "Upload ID required"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if upload exists
    const uploadMetadata = await env.RATE_LIMITS.get(`upload:${upload_id}`);
    if (!uploadMetadata) {
      return new Response(JSON.stringify({
        error: "Upload ID not found or expired"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = JSON.parse(uploadMetadata);
    const validationResults = [];

    // Import the FIT converter for validation logic
    const { convertFitbitToGarmin } = await import('./fit-converter.js');

    // Validate each uploaded file
    for (const fileInfo of metadata.files) {
      try {
        // Retrieve file from R2
        const fileObj = await env.FILE_STORAGE.get(`uploads/${upload_id}/${fileInfo.filename}`);
        if (!fileObj) {
          validationResults.push({
            filename: fileInfo.filename,
            is_valid: false,
            error_message: "File not found in storage"
          });
          continue;
        }

        const content = await fileObj.text();
        const jsonData = JSON.parse(content);

        // Validate format using converter logic
        const isValidFormat = validateGoogleTakeoutFormat(jsonData);

        if (isValidFormat) {
          // Get date range
          const dateRange = getDateRange(jsonData);

          validationResults.push({
            filename: fileInfo.filename,
            is_valid: true,
            entry_count: jsonData.length,
            date_range: dateRange,
            size_kb: Math.round(fileInfo.size / 1024)
          });
        } else {
          validationResults.push({
            filename: fileInfo.filename,
            is_valid: false,
            error_message: "Invalid Google Takeout format. Expected weight data with logId, weight, date, time fields."
          });
        }

      } catch (fileError) {
        console.error(`Validation error for ${fileInfo.filename}:`, fileError);
        validationResults.push({
          filename: fileInfo.filename,
          is_valid: false,
          error_message: fileError.message || "Failed to validate file"
        });
      }
    }

    const allValid = validationResults.every(result => result.is_valid);
    const totalEntries = validationResults
      .filter(result => result.is_valid)
      .reduce((sum, result) => sum + (result.entry_count || 0), 0);

    return new Response(JSON.stringify({
      upload_id: upload_id,
      overall_valid: allValid,
      total_entries: totalEntries,
      files: validationResults,
      message: allValid
        ? `All ${validationResults.length} files are valid and ready for conversion`
        : `${validationResults.filter(r => !r.is_valid).length} of ${validationResults.length} files have validation errors`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(JSON.stringify({
      error: "Validation failed",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Helper function to validate Google Takeout format
function validateGoogleTakeoutFormat(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  // Check first entry for required fields
  const firstEntry = data[0];
  const requiredFields = ['logId', 'weight', 'date', 'time'];

  return requiredFields.every(field => field in firstEntry);
}

// Helper function to get date range from data
function getDateRange(data) {
  if (!data || data.length === 0) return 'No data';

  try {
    const dates = data.map(entry => {
      if (entry.date) {
        const parts = entry.date.split('/');
        const year = parts[2].length === 2 ? Number('20' + parts[2]) : Number(parts[2]);
        const month = Number(parts[0]);
        const day = Number(parts[1]);
        return new Date(year, month - 1, day);
      }
      return null;
    }).filter(date => date !== null);

    if (dates.length === 0) return 'Invalid dates';

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    const formatDate = (date) => {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    if (minDate.getTime() === maxDate.getTime()) {
      return formatDate(minDate);
    } else {
      return `${formatDate(minDate)} to ${formatDate(maxDate)}`;
    }
  } catch (error) {
    return 'Unable to determine date range';
  }
}

async function handleConvert(request, env, corsHeaders, rateLimiter, securityValidator) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check conversion rate limit
  const rateLimitResult = await rateLimiter.checkRateLimit(request, 'conversions');
  if (rateLimitResult?.rateLimited) {
    return rateLimiter.createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    const { upload_id } = await request.json();

    if (!upload_id) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Upload ID required', 400);
    }

    // Check if upload exists and get file count
    const uploadMetadata = await env.RATE_LIMITS.get(`upload:${upload_id}`);
    if (!uploadMetadata) {
      throw createUploadNotFoundError(upload_id);
    }

    const metadata = JSON.parse(uploadMetadata);
    const filesCount = metadata.files.length;

    // Validate that there are files to convert (prevent zero-file spam)
    if (filesCount === 0) {
      return new Response(JSON.stringify({
        error: "No files to convert",
        message: "Upload must contain at least one file."
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check daily limits (3 files/day for free tier)
    const dailyLimitCheck = await rateLimiter.checkDailyLimit(request, filesCount);
    if (!dailyLimitCheck.allowed) {
      const clientId = rateLimiter.getClientId(request);
      const resetDate = new Date(dailyLimitCheck.resetTime * 1000);

      return new Response(JSON.stringify({
        error: "Daily limit reached",
        message: `You've converted ${dailyLimitCheck.filesUsed} files today. Free tier: ${dailyLimitCheck.limit} files per day.`,
        filesUsed: dailyLimitCheck.filesUsed,
        filesRemaining: dailyLimitCheck.filesRemaining,
        limit: dailyLimitCheck.limit,
        resetTime: dailyLimitCheck.resetTime,
        resetDate: resetDate.toISOString(),
        upgradeUrl: "/api/create-checkout-session",
        pricing: {
          "24h": "€2.49 for 24-hour unlimited access",
          "7d": "€5.99 for 7-day unlimited access"
        }
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const conversionId = crypto.randomUUID();
    const failureHandler = new PartialFailureHandler();
    let totalEntries = 0;

    // Import the FIT converter module (now enabled)
    const { convertFitbitToGarmin } = await import('./fit-converter.js');

    // Process each uploaded file with partial failure support
    for (const fileInfo of metadata.files) {
      try {
        // Retrieve file from R2
        const fileObj = await env.FILE_STORAGE.get(`uploads/${upload_id}/${fileInfo.filename}`);
        if (!fileObj) {
          throw createStorageError('retrieve', `File not found: ${fileInfo.filename}`);
        }

        const content = await fileObj.text();
        const jsonData = JSON.parse(content);
        const fileEntries = jsonData.length;

        const conversionResults = await convertFitbitToGarmin([[fileInfo.filename, jsonData]]);
        const [outputFilename, fitData] = conversionResults[0];

        // Store converted file in R2
        try {
          await env.FILE_STORAGE.put(`converted/${conversionId}/${outputFilename}`, fitData, {
            httpMetadata: { contentType: 'application/octet-stream' }
          });
        } catch (storageError) {
          throw createStorageError('store_converted', `Failed to store ${outputFilename}: ${storageError.message}`);
        }

        totalEntries += fileEntries;
        failureHandler.addSuccess(fileInfo.filename, {
          original_filename: fileInfo.filename,
          converted_filename: outputFilename,
          entries: fileEntries
        });

      } catch (fileError) {
        console.error(`Error processing file ${fileInfo.filename}:`, fileError);

        let conversionError;
        if (fileError instanceof AppError) {
          conversionError = fileError;
        } else {
          const msg = (fileError && fileError.message) ? String(fileError.message) : 'Unknown error';
          conversionError = createConversionError(msg);
        }

        failureHandler.addFailure(fileInfo.filename, conversionError);
      }
    }

    // If all files failed, throw error
    if (!failureHandler.hasSuccesses()) {
      throw new AppError(ERROR_CODES.CONVERSION_FAILED, 'All files failed to convert', 500);
    }

    // Get successful results for response
    const successfulResults = failureHandler.getSuccessfulResults();
    const convertedFiles = successfulResults.map(r => r.converted_filename);

    // Store conversion metadata
    try {
      await env.RATE_LIMITS.put(`conversion:${conversionId}`, JSON.stringify({
        upload_id: upload_id,
        files: convertedFiles,
        timestamp: Date.now(),
        total_entries: totalEntries,
        status: failureHandler.hasFailures() ? 'partial_success' : 'completed',
        failed_files: failureHandler.hasFailures() ? failureHandler.errors.length : 0
      }), { expirationTtl: 7200 }); // 2 hours expiration
    } catch (kvError) {
      throw createStorageError('metadata', `Failed to store conversion metadata: ${kvError.message}`);
    }

    // Record conversion for daily limit tracking (free tier only)
    const clientId = rateLimiter.getClientId(request);
    await rateLimiter.recordConversion(clientId, filesCount);

    // Return appropriate response based on success/failure mix
    if (failureHandler.hasFailures() && failureHandler.hasSuccesses()) {
      // Partial success - return 207 Multi-Status
      return new Response(JSON.stringify({
        conversion_id: conversionId,
        files_converted: convertedFiles.length,
        total_entries: totalEntries,
        download_urls: convertedFiles.map(filename => `/api/download/${conversionId}/${filename}`),
        partial_success: true,
        successful_files: successfulResults.length,
        failed_files: failureHandler.errors.length,
        errors: failureHandler.errors,
        message: `${convertedFiles.length} of ${metadata.files.length} files converted successfully`
      }), {
        status: 207, // Multi-Status
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Complete success
      return new Response(JSON.stringify({
        conversion_id: conversionId,
        files_converted: convertedFiles.length,
        total_entries: totalEntries,
        download_urls: convertedFiles.map(filename => `/api/download/${conversionId}/${filename}`),
        message: `Successfully converted ${convertedFiles.length} files`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    // Re-throw AppErrors to be handled by main error handler
    if (error instanceof AppError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new AppError(ERROR_CODES.CONVERSION_FAILED, `Conversion failed: ${error.message}`);
  }
}


async function handleDownload(request, env, corsHeaders) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');

    // Extract conversion_id and filename from /api/download/{conversion_id}/{filename}
    if (pathParts.length < 5) {
      return new Response(JSON.stringify({
        error: "Invalid download URL format"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conversionId = pathParts[3];
    const rawFilename = pathParts.slice(4).join('/');
    // Decode URL-encoded characters (e.g., spaces as %20)
    const filename = decodeURIComponent(rawFilename);

    // Check if conversion exists
    const conversionMetadata = await env.RATE_LIMITS.get(`conversion:${conversionId}`);
    if (!conversionMetadata) {
      return new Response(JSON.stringify({
        error: "Conversion ID not found"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = JSON.parse(conversionMetadata);

    // Check if requested file exists in conversion
    if (!metadata.files.includes(filename)) {
      return new Response(JSON.stringify({
        error: "File not found in conversion"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve file from R2
    const fileObj = await env.FILE_STORAGE.get(`converted/${conversionId}/${filename}`);
    if (!fileObj) {
      return new Response(JSON.stringify({
        error: "File not found in storage"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return the file as a download
    return new Response(fileObj.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileObj.size.toString()
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    return new Response(JSON.stringify({
      error: "Download failed",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Export Durable Object class for Cloudflare Workers
export { RateLimitDO } from './rate-limit-do.js';
