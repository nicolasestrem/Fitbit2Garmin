/**
 * @file Create Stripe Checkout Session Endpoint
 * @description Cloudflare Pages Function for creating a Stripe checkout session.
 * Handles POST requests to `/api/create-checkout-session`.
 */

import { StripeHandler } from './stripe-handler.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Handles requests to create a Stripe checkout session.
 * It validates the request, checks rate limits, and then calls the Stripe handler
 * to create a session, returning the session URL to the client.
 * @param {object} context - The Cloudflare Pages request context.
 * @param {Request} context.request - The incoming request object.
 * @param {object} context.env - The environment variables and bindings.
 * @returns {Promise<Response>} A promise that resolves to a Response object with the
 * checkout session details or an error.
 */
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight (OPTIONS) requests for CORS.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Ensure the request method is POST.
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse the pass type from the request body.
    const { passType } = await request.json();

    // Validate the pass type. It must be either '24h' or '7d'.
    if (!passType || !['24h', '7d'].includes(passType)) {
      return new Response(JSON.stringify({
        error: 'Invalid pass type',
        message: 'Pass type must be "24h" or "7d"'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize services for rate limiting and Stripe.
    const rateLimiter = new RateLimiter(env);
    const clientId = rateLimiter.getClientId(request);

    // Check rate limit for checkout session creation to prevent abuse.
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

    // Initialize the Stripe handler and determine the redirect URLs.
    const stripeHandler = new StripeHandler(env);
    const origin = new URL(request.url).origin;

    // Create the checkout session with Stripe.
    const session = await stripeHandler.createCheckoutSession(
      passType,
      clientId,
      `${origin}?payment_success=true`,
      `${origin}?payment_canceled=true`
    );

    // Return the session details to the client for redirection.
    return new Response(JSON.stringify({
      sessionId: session.sessionId,
      url: session.url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log and return a generic error response if something goes wrong.
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
