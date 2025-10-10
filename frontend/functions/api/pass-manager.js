/**
 * @file Pass Manager
 * @description Handles the logic for validating, creating, and managing user passes
 * for unlimited access, interacting with both D1 and KV for persistence and caching.
 */

/**
 * Manages user passes for premium features.
 */
export class PassManager {
  /**
   * Creates an instance of PassManager.
   * @param {object} env - The Cloudflare environment object.
   */
  constructor(env) {
    this.db = env.RATE_LIMITS_DB;
    this.kv = env.RATE_LIMITS; // For caching
  }

  /**
   * Checks if a client has an active pass, using a caching layer.
   * @param {string} clientId - The client's unique identifier (e.g., IP address).
   * @returns {Promise<boolean>} True if the client has an active pass, false otherwise.
   */
  async hasActivePass(clientId) {
    try {
      const cacheKey = `pass:${clientId}`;
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached?.expires_at && new Date(cached.expires_at) > new Date()) {
        return true;
      }

      const now = new Date().toISOString();
      const { results } = await this.db.prepare(
        `SELECT id, pass_type, expires_at FROM user_passes
         WHERE client_id = ? AND status = 'active' AND expires_at > ?
         ORDER BY expires_at DESC LIMIT 1`
      ).bind(clientId, now).all();

      const hasPass = results.length > 0;
      if (hasPass) {
        await this.kv.put(cacheKey, JSON.stringify(results[0]), { expirationTtl: 300 });
      }
      return hasPass;
    } catch (error) {
      console.error('Failed to check active pass:', error);
      return false; // Fail open: if DB is down, don't block users.
    }
  }

  /**
   * Retrieves the details of a client's active pass.
   * @param {string} clientId - The client's unique identifier.
   * @returns {Promise<object|null>} The active pass details or null if none exists.
   */
  async getActivePass(clientId) {
    try {
      const now = new Date().toISOString();
      const { results } = await this.db.prepare(
        `SELECT id, pass_type, purchased_at, expires_at, amount_cents, currency
         FROM user_passes WHERE client_id = ? AND status = 'active' AND expires_at > ?
         ORDER BY expires_at DESC LIMIT 1`
      ).bind(clientId, now).all();

      if (results.length === 0) return null;

      const pass = results[0];
      const expiresAt = new Date(pass.expires_at);
      const hoursRemaining = Math.ceil((expiresAt - new Date()) / 36e5); // 1000 * 60 * 60

      return {
        passType: pass.pass_type,
        purchasedAt: pass.purchased_at,
        expiresAt: pass.expires_at,
        hoursRemaining,
        amountCents: pass.amount_cents,
        currency: pass.currency
      };
    } catch (error) {
      console.error('Failed to get active pass:', error);
      return null;
    }
  }

  /**
   * Creates a new user pass in the database after a successful payment.
   * @param {string} clientId - The client's identifier.
   * @param {'24h'|'7d'} passType - The type of pass purchased.
   * @param {string} stripeSessionId - The ID of the Stripe checkout session.
   * @param {string} paymentIntent - The ID of the Stripe payment intent.
   * @param {number} amountCents - The amount paid in cents.
   * @returns {Promise<object>} An object confirming the pass creation.
   * @throws {Error} If the database insertion fails.
   */
  async createPass(clientId, passType, stripeSessionId, paymentIntent, amountCents) {
    try {
      const now = new Date();
      const durationHours = passType === '24h' ? 24 : 168;
      const expiresAt = new Date(now.getTime() + durationHours * 36e5);

      // Invalidate cache before writing to DB to prevent race conditions.
      await this.kv.delete(`pass:${clientId}`);

      await this.db.prepare(
        `INSERT INTO user_passes (client_id, pass_type, stripe_session_id, stripe_payment_intent, amount_cents, currency, expires_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
      ).bind(clientId, passType, stripeSessionId, paymentIntent, amountCents, 'eur', expiresAt.toISOString()).run();

      return { success: true, passType, expiresAt: expiresAt.toISOString(), duration: durationHours };
    } catch (error) {
      console.error('Failed to create pass:', error);
      throw error;
    }
  }

  /**
   * Marks a pass as 'refunded' using the Stripe session ID.
   * @param {string} stripeSessionId - The Stripe checkout session ID.
   * @returns {Promise<boolean>} True if the pass was successfully marked as refunded.
   */
  async refundPass(stripeSessionId) {
    try {
      const result = await this.db.prepare(
        `UPDATE user_passes SET status = 'refunded', updated_at = datetime('now')
         WHERE stripe_session_id = ? RETURNING client_id`
      ).bind(stripeSessionId).first();

      if (result) {
        await this.kv.delete(`pass:${result.client_id}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refund pass:', error);
      return false;
    }
  }

  /**
   * Marks a pass as 'refunded' using the Stripe payment intent ID.
   * @param {string} paymentIntent - The Stripe payment intent ID.
   * @returns {Promise<boolean>} True if the pass was successfully marked as refunded.
   */
  async refundPassByPaymentIntent(paymentIntent) {
    try {
      const result = await this.db.prepare(
        `UPDATE user_passes SET status = 'refunded', updated_at = datetime('now')
         WHERE stripe_payment_intent = ? RETURNING client_id`
      ).bind(paymentIntent).first();

      if (result) {
        await this.kv.delete(`pass:${result.client_id}`);
        console.log(`Pass refunded for payment intent ${paymentIntent}, client: ${result.client_id}`);
        return true;
      }
      console.warn(`No pass found for payment intent: ${paymentIntent}`);
      return false;
    } catch (error) {
      console.error('Failed to refund pass by payment intent:', error);
      return false;
    }
  }

  /**
   * Marks active passes as 'expired' if their expiration date has passed.
   * This is intended to be run periodically as a maintenance task.
   * @returns {Promise<number>} The number of passes that were expired.
   */
  async expireOldPasses() {
    try {
      const now = new Date().toISOString();
      const result = await this.db.prepare(
        `UPDATE user_passes SET status = 'expired', updated_at = datetime('now')
         WHERE status = 'active' AND expires_at < ?`
      ).bind(now).run();
      console.log(`Expired ${result.changes} passes`);
      return result.changes || 0;
    } catch (error) {
      console.error('Failed to expire passes:', error);
      return 0;
    }
  }

  /**
   * Retrieves pass sales statistics for analytics.
   * @param {number} [days=7] - The number of past days to retrieve stats for.
   * @returns {Promise<object>} An object containing aggregated pass statistics.
   */
  async getPassStats(days = 7) {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 36e5).toISOString().split('T')[0];
      const { results } = await this.db.prepare(
        `SELECT * FROM pass_analytics WHERE date >= ? ORDER BY date DESC, pass_type`
      ).bind(cutoff).all();
      return {
        byType: results,
        totalRevenue: results.reduce((sum, row) => sum + (row.revenue_cents || 0), 0),
        totalPasses: results.reduce((sum, row) => sum + (row.passes_sold || 0), 0)
      };
    } catch (error) {
      console.error('Failed to get pass stats:', error);
      return { byType: [], totalRevenue: 0, totalPasses: 0 };
    }
  }
}
