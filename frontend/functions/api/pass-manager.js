/**
 * Pass Manager - Handles user pass validation and status
 * Manages 24-hour and 7-day unlimited passes
 */

export class PassManager {
  constructor(env) {
    this.db = env.RATE_LIMITS_DB;
    this.kv = env.RATE_LIMITS; // For caching
  }

  /**
   * Check if a client has an active pass
   * @param {string} clientId - Client identifier (IP address)
   * @returns {Promise<boolean>}
   */
  async hasActivePass(clientId) {
    try {
      // Check cache first
      const cacheKey = `pass:${clientId}`;
      const cached = await this.kv.get(cacheKey, 'json');

      if (cached && cached.expires_at) {
        const expiresAt = new Date(cached.expires_at);
        if (expiresAt > new Date()) {
          return true;
        }
      }

      // Query D1 for active passes
      const now = new Date().toISOString();
      const { results } = await this.db.prepare(`
        SELECT id, pass_type, expires_at
        FROM user_passes
        WHERE client_id = ?
          AND status = 'active'
          AND expires_at > ?
        ORDER BY expires_at DESC
        LIMIT 1
      `).bind(clientId, now).all();

      const hasPass = results.length > 0;

      if (hasPass) {
        // Cache the result for 5 minutes
        await this.kv.put(cacheKey, JSON.stringify(results[0]), {
          expirationTtl: 300
        });
      }

      return hasPass;
    } catch (error) {
      console.error('Failed to check active pass:', error);
      // Fail open - allow access if database is down
      return false;
    }
  }

  /**
   * Get active pass details for a client
   * @param {string} clientId - Client identifier
   * @returns {Promise<Object|null>}
   */
  async getActivePass(clientId) {
    try {
      const now = new Date().toISOString();
      const { results } = await this.db.prepare(`
        SELECT
          id,
          pass_type,
          purchased_at,
          expires_at,
          amount_cents,
          currency
        FROM user_passes
        WHERE client_id = ?
          AND status = 'active'
          AND expires_at > ?
        ORDER BY expires_at DESC
        LIMIT 1
      `).bind(clientId, now).all();

      if (results.length === 0) {
        return null;
      }

      const pass = results[0];
      const expiresAt = new Date(pass.expires_at);
      const nowDate = new Date();
      const hoursRemaining = Math.ceil((expiresAt - nowDate) / (1000 * 60 * 60));

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
   * Create a new pass after successful payment
   * @param {string} clientId - Client identifier
   * @param {string} passType - '24h' or '7d'
   * @param {string} stripeSessionId - Stripe checkout session ID
   * @param {string} paymentIntent - Stripe payment intent ID
   * @param {number} amountCents - Amount paid in cents
   * @returns {Promise<Object>}
   */
  async createPass(clientId, passType, stripeSessionId, paymentIntent, amountCents) {
    try {
      const now = new Date();
      const duration = passType === '24h' ? 24 : 168; // 24 hours or 7 days
      const expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000);

      await this.db.prepare(`
        INSERT INTO user_passes (
          client_id,
          pass_type,
          stripe_session_id,
          stripe_payment_intent,
          amount_cents,
          currency,
          expires_at,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `).bind(
        clientId,
        passType,
        stripeSessionId,
        paymentIntent,
        amountCents,
        'eur',
        expiresAt.toISOString()
      ).run();

      // Clear cache to force refresh
      await this.kv.delete(`pass:${clientId}`);

      return {
        success: true,
        passType,
        expiresAt: expiresAt.toISOString(),
        duration
      };
    } catch (error) {
      console.error('Failed to create pass:', error);
      throw error;
    }
  }

  /**
   * Mark a pass as refunded
   * @param {string} stripeSessionId - Stripe checkout session ID
   * @returns {Promise<boolean>}
   */
  async refundPass(stripeSessionId) {
    try {
      const result = await this.db.prepare(`
        UPDATE user_passes
        SET status = 'refunded', updated_at = datetime('now')
        WHERE stripe_session_id = ?
        RETURNING client_id
      `).bind(stripeSessionId).first();

      if (result) {
        // Clear cache
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
   * Expire old passes (run periodically)
   * @returns {Promise<number>} Number of passes expired
   */
  async expireOldPasses() {
    try {
      const now = new Date().toISOString();

      const result = await this.db.prepare(`
        UPDATE user_passes
        SET status = 'expired', updated_at = datetime('now')
        WHERE status = 'active'
          AND expires_at < ?
      `).bind(now).run();

      console.log(`Expired ${result.changes} passes`);
      return result.changes || 0;
    } catch (error) {
      console.error('Failed to expire passes:', error);
      return 0;
    }
  }

  /**
   * Get pass statistics for analytics
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>}
   */
  async getPassStats(days = 7) {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { results } = await this.db.prepare(`
        SELECT * FROM pass_analytics
        WHERE date >= ?
        ORDER BY date DESC, pass_type
      `).bind(cutoff).all();

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
