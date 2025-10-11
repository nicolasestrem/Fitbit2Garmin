/**
 * @file Stripe Webhook Endpoint
 * @description Cloudflare Pages Function for handling incoming Stripe webhook events.
 * It verifies the event signature and processes relevant events like `checkout.session.completed`.
 * Route: POST /api/stripe-webhook
 */

import { StripeHandler } from './stripe-handler.js';

/**
 * Handles incoming Stripe webhook events.
 * @param {object} context - The Cloudflare Pages request context.
 * @param {Request} context.request - The incoming request object.
 * @param {object} context.env - The environment variables and bindings.
 * @returns {Promise<Response>} A promise that resolves to a Response object indicating
 * the result of the webhook processing.
 */
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature'
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
    // Stripe requires the raw request body to verify the signature.
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = await request.text();
    const stripeHandler = new StripeHandler(env);

    // Verify the webhook signature to ensure the request is from Stripe.
    const event = stripeHandler.verifyWebhookSignature(payload, signature);

    // Process the verified event.
    const result = await stripeHandler.processWebhookEvent(event);

    return new Response(JSON.stringify({ received: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log and return an error response if processing fails.
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({
      error: 'Webhook processing failed',
      message: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
