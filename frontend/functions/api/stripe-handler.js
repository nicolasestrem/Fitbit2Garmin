/**
 * @file Stripe Handler
 * @description Manages interactions with the Stripe API for payment processing,
 * including creating checkout sessions and handling webhooks.
 */

import Stripe from 'stripe';
import { PassManager } from './pass-manager.js';

/**
 * A class to handle all Stripe-related operations.
 */
export class StripeHandler {
  /**
   * Creates an instance of StripeHandler.
   * @param {object} env - The Cloudflare environment object containing secrets.
   */
  constructor(env) {
    this.env = env;
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    this.passManager = new PassManager(env);
    this.pricing = {
      '24h': { cents: 249, currency: 'eur', name: '24-hour pass', duration: 24 },
      '7d': { cents: 599, currency: 'eur', name: '7-day pass', duration: 168 }
    };
  }

  /**
   * Creates a new Stripe checkout session for purchasing a pass.
   * @param {'24h' | '7d'} passType - The type of pass to be purchased.
   * @param {string} clientId - The unique identifier for the client.
   * @param {string} successUrl - The URL to redirect to on successful payment.
   * @param {string} cancelUrl - The URL to redirect to if the payment is canceled.
   * @returns {Promise<{sessionId: string, url: string, expiresAt: number}>} The details of the created session.
   */
  async createCheckoutSession(passType, clientId, successUrl, cancelUrl) {
    try {
      if (!this.pricing[passType]) throw new Error(`Invalid pass type: ${passType}`);
      const price = this.pricing[passType];

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: price.currency,
            product_data: {
              name: `Fitbit2Garmin ${price.name}`,
              description: `Unlimited file conversions for ${price.duration} hours`,
              images: ['https://fitbit2garmin.app/logo.png']
            },
            unit_amount: price.cents
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: clientId,
        metadata: { pass_type: passType, client_id: clientId, duration_hours: price.duration.toString() },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes expiry
      });

      return { sessionId: session.id, url: session.url, expiresAt: session.expires_at };
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw new Error(`Checkout session creation failed: ${error.message}`);
    }
  }

  /**
   * Verifies the signature of an incoming Stripe webhook to ensure it's authentic.
   * @param {string} payload - The raw request body of the webhook.
   * @param {string} signature - The value of the 'stripe-signature' header.
   * @returns {Stripe.Event} The verified Stripe event object.
   * @throws {Error} If the signature is invalid or the secret is not configured.
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const webhookSecret = this.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) throw new Error('Webhook secret not configured');
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Handles the `checkout.session.completed` webhook event by creating a pass for the user.
   * @param {Stripe.Checkout.Session} session - The Stripe checkout session object from the webhook.
   * @returns {Promise<object>} The result of the pass creation.
   * @private
   */
  async handleCheckoutCompleted(session) {
    try {
      const { client_id: clientId, pass_type: passType } = session.metadata;
      const { payment_intent: paymentIntent, amount_total: amountCents } = session;
      if (!clientId || !passType) throw new Error('Missing required metadata in session');
      if (!paymentIntent) console.warn('Payment intent is null - payment may be pending', { sessionId: session.id, paymentStatus: session.payment_status });

      const result = await this.passManager.createPass(clientId, passType, session.id, paymentIntent, amountCents);
      console.log('Pass created successfully:', { clientId, passType, sessionId: session.id, expiresAt: result.expiresAt });
      return result;
    } catch (error) {
      console.error('Failed to handle checkout completion:', error);
      throw error;
    }
  }

  /**
   * Handles the `charge.refunded` webhook event by revoking the corresponding user pass.
   * @param {Stripe.Charge} charge - The Stripe charge object from the webhook.
   * @returns {Promise<boolean>} True if a pass was successfully refunded.
   * @private
   */
  async handleChargeRefunded(charge) {
    try {
      const paymentIntent = charge.payment_intent;
      if (!paymentIntent) {
        console.warn('No payment intent in refunded charge');
        return false;
      }
      console.log('Processing refund for payment intent:', paymentIntent);
      const success = await this.passManager.refundPassByPaymentIntent(paymentIntent);
      if (success) {
        console.log(`Successfully revoked pass for refunded payment: ${paymentIntent}`);
      } else {
        console.warn(`Could not find pass to refund for payment intent: ${paymentIntent}`);
      }
      return success;
    } catch (error) {
      console.error('Failed to handle charge refund:', error);
      return false;
    }
  }

  /**
   * Processes a verified Stripe webhook event by routing it to the appropriate handler.
   * @param {Stripe.Event} event - The verified Stripe event object.
   * @returns {Promise<{handled: boolean, type: string}>} An object indicating if the event was handled and its type.
   */
  async processWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          return { handled: true, type: 'checkout_completed' };
        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object);
          return { handled: true, type: 'charge_refunded' };
        case 'payment_intent.payment_failed':
          console.log('Payment failed:', event.data.object.id);
          return { handled: true, type: 'payment_failed' };
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
   * Retrieves the details of a Stripe checkout session.
   * @param {string} sessionId - The ID of the Stripe session to retrieve.
   * @returns {Promise<object>} An object with key details of the session.
   */
  async getSessionDetails(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return {
        id: session.id, status: session.payment_status, amount: session.amount_total,
        currency: session.currency, clientId: session.metadata?.client_id,
        passType: session.metadata?.pass_type, createdAt: new Date(session.created * 1000).toISOString(),
        expiresAt: new Date(session.expires_at * 1000).toISOString()
      };
    } catch (error) {
      console.error('Failed to get session details:', error);
      throw error;
    }
  }

  /**
   * Gets the pricing information for all available passes.
   * @returns {object} An object containing the pricing details.
   */
  getPricing() {
    return {
      '24h': { ...this.pricing['24h'], priceFormatted: `€${(this.pricing['24h'].cents / 100).toFixed(2)}` },
      '7d': { ...this.pricing['7d'], priceFormatted: `€${(this.pricing['7d'].cents / 100).toFixed(2)}` }
    };
  }
}
