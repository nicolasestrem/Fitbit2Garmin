/**
 * Cloudflare Pages Function to handle API routes
 * This will eventually replace the FastAPI backend
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

  // For now, return mock data
  // TODO: Implement proper rate limiting with KV store
  const usageData = {
    conversions_used: 0,
    conversions_limit: 2,
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

  // For now, return a mock response
  // TODO: Implement file upload handling
  return new Response(JSON.stringify({
    error: "Upload functionality not yet implemented",
    message: "API migration in progress - please check back soon"
  }), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
  return new Response(JSON.stringify({
    error: "Conversion functionality not yet implemented",
    message: "API migration in progress - please check back soon"
  }), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDownload(request, env, corsHeaders) {
  return new Response(JSON.stringify({
    error: "Download functionality not yet implemented",
    message: "API migration in progress - please check back soon"
  }), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}