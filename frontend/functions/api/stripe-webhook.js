/**
 * Stripe Webhook Endpoint
 * Route: POST /api/stripe-webhook
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed: Create pass after successful payment
 * - charge.refunded: Revoke pass when refund is processed
 */

import { StripeHandler } from './stripe-handler.js';

/**
 * Handle Stripe webhook events
 */
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature'
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
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get raw body for signature verification
    const payload = await request.text();

    const stripeHandler = new StripeHandler(env);

    // Verify webhook signature
    const event = stripeHandler.verifyWebhookSignature(payload, signature);

    // Process the event
    const result = await stripeHandler.processWebhookEvent(event);

    return new Response(JSON.stringify({
      received: true,
      ...result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
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
