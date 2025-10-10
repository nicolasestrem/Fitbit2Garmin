/**
 * Payment API Endpoint - Handles Stripe checkout and webhooks
 * Routes:
 *   POST /api/create-checkout-session - Create Stripe session
 *   POST /api/stripe-webhook - Handle Stripe webhooks
 *   GET /api/pass-status - Check user's pass status
 */

import { StripeHandler } from './stripe-handler.js';
import { PassManager } from './pass-manager.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Handle payment-related requests
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Route requests
    if (pathname === '/api/create-checkout-session') {
      return handleCreateCheckoutSession(request, env, corsHeaders);
    } else if (pathname === '/api/stripe-webhook') {
      return handleStripeWebhook(request, env, corsHeaders);
    } else if (pathname === '/api/pass-status') {
      return handlePassStatus(request, env, corsHeaders);
    } else if (pathname === '/api/pricing') {
      return handlePricing(request, env, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Payment API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create a Stripe checkout session
 */
async function handleCreateCheckoutSession(request, env, corsHeaders) {
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
      `${origin}?payment=success`,
      `${origin}?payment=cancelled`
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

/**
 * Handle Stripe webhook events
 */
async function handleStripeWebhook(request, env, corsHeaders) {
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

/**
 * Get pass status for current user
 */
async function handlePassStatus(request, env, corsHeaders) {
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

/**
 * Get pricing information
 */
async function handlePricing(request, env, corsHeaders) {
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
