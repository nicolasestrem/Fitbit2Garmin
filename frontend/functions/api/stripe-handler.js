/**
 * Stripe Handler - Payment processing and webhook handling
 * Manages Stripe checkout sessions and payment confirmations
 */

import Stripe from 'stripe';
import { PassManager } from './pass-manager.js';

export class StripeHandler {
  constructor(env) {
    this.env = env;
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    this.passManager = new PassManager(env);

    // Pass pricing (in cents)
    this.pricing = {
      '24h': { cents: 249, currency: 'eur', name: '24-hour pass', duration: 24 },
      '7d': { cents: 599, currency: 'eur', name: '7-day pass', duration: 168 }
    };
  }

  /**
   * Create a Stripe checkout session
   * @param {string} passType - '24h' or '7d'
   * @param {string} clientId - Client identifier (IP address)
   * @param {string} successUrl - URL to redirect after successful payment
   * @param {string} cancelUrl - URL to redirect after cancelled payment
   * @returns {Promise<Object>}
   */
  async createCheckoutSession(passType, clientId, successUrl, cancelUrl) {
    try {
      if (!this.pricing[passType]) {
        throw new Error(`Invalid pass type: ${passType}`);
      }

      const price = this.pricing[passType];

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: price.currency,
              product_data: {
                name: `Fitbit2Garmin ${price.name}`,
                description: `Unlimited file conversions for ${price.duration} hours`,
                // TODO: Replace with actual logo URL or make configurable via env variable
                // If logo file doesn't exist, Stripe will show product name only
                images: ['https://fitbit2garmin.app/logo.png']
              },
              unit_amount: price.cents
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: clientId,
        metadata: {
          pass_type: passType,
          client_id: clientId,
          duration_hours: price.duration.toString()
        },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes expiry
      });

      return {
        sessionId: session.id,
        url: session.url,
        expiresAt: session.expires_at
      };
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw new Error(`Checkout session creation failed: ${error.message}`);
    }
  }

  /**
   * Verify Stripe webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} - Verified event object
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const webhookSecret = this.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Handle successful checkout completion
   * @param {Object} session - Stripe checkout session object
   * @returns {Promise<Object>}
   */
  async handleCheckoutCompleted(session) {
    try {
      const clientId = session.metadata.client_id;
      const passType = session.metadata.pass_type;
      const paymentIntent = session.payment_intent;
      const amountCents = session.amount_total;

      if (!clientId || !passType) {
        throw new Error('Missing required metadata in session');
      }

      // Check if payment intent is available
      // Note: payment_intent can be null if payment is still pending
      // In production, this should be handled by waiting for payment_intent.succeeded event
      if (!paymentIntent) {
        console.warn('Payment intent is null - payment may be pending', {
          sessionId: session.id,
          paymentStatus: session.payment_status
        });
        // For now, use session ID as fallback
        // TODO: Consider handling this via payment_intent.succeeded webhook instead
      }

      // Create the pass in database
      const result = await this.passManager.createPass(
        clientId,
        passType,
        session.id,
        paymentIntent,
        amountCents
      );

      console.log('Pass created successfully:', {
        clientId,
        passType,
        sessionId: session.id,
        expiresAt: result.expiresAt
      });

      return result;
    } catch (error) {
      console.error('Failed to handle checkout completion:', error);
      throw error;
    }
  }

  /**
   * Handle charge refunded event
   * @param {Object} charge - Stripe charge object
   * @returns {Promise<boolean>}
   */
  async handleChargeRefunded(charge) {
    try {
      const paymentIntent = charge.payment_intent;

      if (!paymentIntent) {
        console.warn('No payment intent in refunded charge');
        return false;
      }

      console.log('Processing refund for payment intent:', paymentIntent);

      // Mark the pass as refunded using payment intent
      const success = await this.passManager.refundPassByPaymentIntent(paymentIntent);

      if (success) {
        console.log(`Successfully revoked pass for refunded payment: ${paymentIntent}`);
        return true;
      } else {
        console.warn(`Could not find pass to refund for payment intent: ${paymentIntent}`);
        return false;
      }
    } catch (error) {
      console.error('Failed to handle charge refund:', error);
      return false;
    }
  }

  /**
   * Process webhook event
   * @param {Object} event - Verified Stripe event
   * @returns {Promise<Object>}
   */
  async processWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          await this.handleCheckoutCompleted(session);
          return { handled: true, type: 'checkout_completed' };
        }

        case 'charge.refunded': {
          const charge = event.data.object;
          await this.handleChargeRefunded(charge);
          return { handled: true, type: 'charge_refunded' };
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;
          console.log('Payment failed:', paymentIntent.id);
          return { handled: true, type: 'payment_failed' };
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
          return { handled: false, type: event.type };
      }
    } catch (error) {
      console.error('Failed to process webhook event:', error);
      throw error;
    }
  }

  /**
   * Get session details
   * @param {string} sessionId - Stripe session ID
   * @returns {Promise<Object>}
   */
  async getSessionDetails(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      return {
        id: session.id,
        status: session.payment_status,
        amount: session.amount_total,
        currency: session.currency,
        clientId: session.metadata?.client_id,
        passType: session.metadata?.pass_type,
        createdAt: new Date(session.created * 1000).toISOString(),
        expiresAt: new Date(session.expires_at * 1000).toISOString()
      };
    } catch (error) {
      console.error('Failed to get session details:', error);
      throw error;
    }
  }

  /**
   * Get pricing information
   * @returns {Object}
   */
  getPricing() {
    return {
      '24h': {
        ...this.pricing['24h'],
        priceFormatted: `€${(this.pricing['24h'].cents / 100).toFixed(2)}`
      },
      '7d': {
        ...this.pricing['7d'],
        priceFormatted: `€${(this.pricing['7d'].cents / 100).toFixed(2)}`
      }
    };
  }
}
