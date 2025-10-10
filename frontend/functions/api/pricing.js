/**
 * Pricing Information Endpoint
 * Route: GET /api/pricing
 *
 * Returns pricing information for available passes
 */

import { StripeHandler } from './stripe-handler.js';

/**
 * Get pricing information
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
    const stripeHandler = new StripeHandler(env);
    const pricing = stripeHandler.getPricing();

    return new Response(JSON.stringify(pricing), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Pricing fetch error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get pricing',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
