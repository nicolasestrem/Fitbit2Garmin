/**
 * Create Stripe Checkout Session Endpoint
 * Route: POST /api/create-checkout-session
 */

import { StripeHandler } from './stripe-handler.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Handle checkout session creation requests
 */
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { passType } = await request.json();

    if (!passType || !['24h', '7d'].includes(passType)) {
      return new Response(JSON.stringify({
        error: 'Invalid pass type',
        message: 'Pass type must be "24h" or "7d"'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get client ID (IP address)
    const rateLimiter = new RateLimiter(env);
    const clientId = rateLimiter.getClientId(request);

    // Check rate limit for checkout session creation
    // TODO P3: Add dedicated checkout rate limit (5 sessions per hour)
    const checkoutLimit = await rateLimiter.checkRateLimit(request, 'suspicious');
    if (checkoutLimit?.rateLimited) {
      return new Response(JSON.stringify({
        error: 'Too many requests',
        message: 'Please wait before creating another checkout session'
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create checkout session
    const stripeHandler = new StripeHandler(env);
    const origin = new URL(request.url).origin;

    const session = await stripeHandler.createCheckoutSession(
      passType,
      clientId,
      `${origin}?payment_success=true`,
      `${origin}?payment_canceled=true`
    );

    return new Response(JSON.stringify({
      sessionId: session.sessionId,
      url: session.url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Checkout session creation error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
