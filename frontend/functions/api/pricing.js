/**
 * @file Pricing Information Endpoint
 * @description Cloudflare Pages Function for retrieving pricing information for available passes.
 * Handles GET requests to `/api/pricing`.
 */

import { StripeHandler } from './stripe-handler.js';

/**
 * Handles requests to get pricing information.
 * It retrieves the pricing details from the Stripe handler and returns them.
 * @param {object} context - The Cloudflare Pages request context.
 * @param {Request} context.request - The incoming request object.
 * @param {object} context.env - The environment variables and bindings.
 * @returns {Promise<Response>} A promise that resolves to a Response object with
 * the pricing information or an error.
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
    // Get pricing from the Stripe handler.
    const stripeHandler = new StripeHandler(env);
    const pricing = stripeHandler.getPricing();

    // Return the pricing data.
    return new Response(JSON.stringify(pricing), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log and return a generic error response if something goes wrong.
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
