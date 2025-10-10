/**
 * Pass Status Endpoint
 * Route: GET /api/pass-status
 *
 * Returns current user's pass status (active pass or free tier)
 */

import { PassManager } from './pass-manager.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Get pass status for current user
 */
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get client ID (IP address)
    const rateLimiter = new RateLimiter(env);
    const clientId = rateLimiter.getClientId(request);

    const passManager = new PassManager(env);
    const activePass = await passManager.getActivePass(clientId);

    if (!activePass) {
      return new Response(JSON.stringify({
        hasPass: false,
        passType: null,
        expiresAt: null,
        hoursRemaining: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      hasPass: true,
      passType: activePass.passType,
      expiresAt: activePass.expiresAt,
      hoursRemaining: activePass.hoursRemaining,
      purchasedAt: activePass.purchasedAt
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Pass status check error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to check pass status',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
