/**
 * @file Pass Status Endpoint
 * @description Cloudflare Pages Function for retrieving a user's current pass status.
 * Handles GET requests to `/api/pass-status`.
 */

import { PassManager } from './pass-manager.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Handles requests to get the current user's pass status.
 * It determines if the user has an active premium pass or is on the free tier.
 * @param {object} context - The Cloudflare Pages request context.
 * @param {Request} context.request - The incoming request object.
 * @param {object} context.env - The environment variables and bindings.
 * @returns {Promise<Response>} A promise that resolves to a Response object with the
 * user's pass status or an error.
 */
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight (OPTIONS) requests for CORS.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Ensure the request method is GET.
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get the client's unique identifier.
    const rateLimiter = new RateLimiter(env);
    const clientId = rateLimiter.getClientId(request);

    // Check for an active pass.
    const passManager = new PassManager(env);
    const activePass = await passManager.getActivePass(clientId);

    // If no active pass is found, return the free tier status.
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

    // If an active pass is found, return its details.
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
    // Log and return a generic error response if something goes wrong.
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
