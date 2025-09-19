/**
 * Cloudflare Pages Function to handle API routes
 * This replaces the FastAPI backend with proper R2 storage
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Basic routing
    if (pathname.startsWith('/api/usage/')) {
      return handleUsage(request, env, corsHeaders);
    } else if (pathname === '/api/upload') {
      return handleUpload(request, env, corsHeaders);
    } else if (pathname === '/api/validate') {
      return handleValidate(request, env, corsHeaders);
    } else if (pathname === '/api/convert') {
      return handleConvert(request, env, corsHeaders);
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
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

async function handleUpload(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files');

    // Validate file count
    if (files.length > 3) {
      return new Response(JSON.stringify({
        error: "Maximum 3 files allowed."
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (files.length === 0) {
      return new Response(JSON.stringify({
        error: "No files provided"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate upload ID
    const uploadId = crypto.randomUUID();
    const fileData = [];

    // Process each file
    for (const file of files) {
      if (!file.name.endsWith('.json')) {
        return new Response(JSON.stringify({
          error: `Invalid file type: ${file.name}. Only .json files are supported.`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Read and validate JSON
      const content = await file.text();
      try {
        const jsonData = JSON.parse(content);
        fileData.push({
          filename: file.name,
          data: jsonData
        });

        // Store file in R2
        await env.FILE_STORAGE.put(`uploads/${uploadId}/${file.name}`, content, {
          httpMetadata: {
            contentType: 'application/json'
          }
        });
      } catch (jsonError) {
        return new Response(JSON.stringify({
          error: `Invalid JSON in file: ${file.name}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Store metadata in KV
    await env.RATE_LIMITS.put(`upload:${uploadId}`, JSON.stringify({
      files: fileData.map(f => ({ filename: f.filename, size: JSON.stringify(f.data).length })),
      timestamp: Date.now(),
      status: 'uploaded'
    }), { expirationTtl: 3600 }); // 1 hour expiration

    return new Response(JSON.stringify({
      upload_id: uploadId,
      files_received: files.length,
      message: `Successfully uploaded ${files.length} files`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({
      error: "Upload failed",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleValidate(request, env, corsHeaders) {
  return new Response(JSON.stringify({
    error: "Validation functionality not yet implemented",
    message: "API migration in progress - please check back soon"
  }), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleConvert(request, env, corsHeaders) {
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
        error: "Upload ID not found"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = JSON.parse(uploadMetadata);
    const conversionId = crypto.randomUUID();
    const convertedFiles = [];
    let totalEntries = 0;

    // Import the FIT converter module (now enabled)
    const { convertFitbitToGarmin } = await import('./fit-converter.js');

    // Process each uploaded file
    for (const fileInfo of metadata.files) {
      try {
        // Retrieve file from R2
        const fileObj = await env.FILE_STORAGE.get(`uploads/${upload_id}/${fileInfo.filename}`);
        if (!fileObj) {
          throw new Error(`File not found: ${fileInfo.filename}`);
        }

        const content = await fileObj.text();
        const jsonData = JSON.parse(content);
        totalEntries += jsonData.length;

        const conversionResults = await convertFitbitToGarmin([[fileInfo.filename, jsonData]]);
        const [outputFilename, fitData] = conversionResults[0];

        // Store converted file in R2
        await env.FILE_STORAGE.put(`converted/${conversionId}/${outputFilename}`, fitData, {
          httpMetadata: { contentType: 'application/octet-stream' }
        });

        convertedFiles.push(outputFilename);

      } catch (fileError) {
        console.error(`Error processing file ${fileInfo.filename}:`, fileError);
        const msg = (fileError && fileError.message) ? String(fileError.message) : 'Unknown error';
        const isSdkIssue = msg.toLowerCase().includes('garmin fit sdk') || msg.toLowerCase().includes('fitsdk');
        return new Response(JSON.stringify({
          error: `Failed to process file: ${fileInfo.filename}`,
          details: msg,
          error_code: isSdkIssue ? 'SDK_UNAVAILABLE' : 'CONVERT_FAILED'
        }), {
          status: isSdkIssue ? 501 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Store conversion metadata
    await env.RATE_LIMITS.put(`conversion:${conversionId}`, JSON.stringify({
      upload_id: upload_id,
      files: convertedFiles,
      timestamp: Date.now(),
      total_entries: totalEntries,
      status: 'completed'
    }), { expirationTtl: 7200 }); // 2 hours expiration

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

  } catch (error) {
    console.error('Conversion error:', error);
    return new Response(JSON.stringify({
      error: "Conversion failed",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
