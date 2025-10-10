/**
 * Daily Limit Tracker - Enforces 3 files per day for free tier users
 * Resets at midnight UTC daily
 */

export class DailyLimitTracker {
  constructor(env) {
    this.db = env.RATE_LIMITS_DB;
    this.dailyLimit = 3; // 3 files per day for free users
  }

  /**
   * Get current UTC date in YYYY-MM-DD format
   * @returns {string}
   */
  getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Get usage for a client on the current day
   * @param {string} clientId - Client identifier
   * @returns {Promise<Object>}
   */
  async getUsage(clientId) {
    try {
      const today = this.getCurrentDate();

      const { results } = await this.db.prepare(`
        SELECT files_converted, conversions, updated_at
        FROM daily_usage
        WHERE client_id = ? AND date = ?
      `).bind(clientId, today).all();

      if (results.length === 0) {
        // No usage today yet
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        return {
          filesConverted: 0,
          conversions: 0,
          filesRemaining: this.dailyLimit,
          resetTime: Math.floor(tomorrow.getTime() / 1000),
          date: today
        };
      }

      const usage = results[0];
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      return {
        filesConverted: usage.files_converted || 0,
        conversions: usage.conversions || 0,
        filesRemaining: Math.max(0, this.dailyLimit - (usage.files_converted || 0)),
        resetTime: Math.floor(tomorrow.getTime() / 1000),
        date: today
      };
    } catch (error) {
      console.error('Failed to get daily usage:', error);

      // Default to no usage on error
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      return {
        filesConverted: 0,
        conversions: 0,
        filesRemaining: this.dailyLimit,
        resetTime: Math.floor(tomorrow.getTime() / 1000),
        date: this.getCurrentDate(),
        error: true
      };
    }
  }

  /**
   * Check if a client can convert files (within daily limit)
   * @param {string} clientId - Client identifier
   * @param {number} filesCount - Number of files to convert
   * @returns {Promise<Object>}
   */
  async canConvert(clientId, filesCount) {
    const usage = await this.getUsage(clientId);

    const allowed = (usage.filesConverted + filesCount) <= this.dailyLimit;

    return {
      allowed,
      filesConverted: usage.filesConverted,
      filesRemaining: Math.max(0, usage.filesRemaining - filesCount),
      limit: this.dailyLimit,
      resetTime: usage.resetTime,
      wouldExceed: !allowed,
      excessFiles: allowed ? 0 : (usage.filesConverted + filesCount - this.dailyLimit)
    };
  }

  /**
   * Record a conversion (increment usage counters)
   * @param {string} clientId - Client identifier
   * @param {number} filesCount - Number of files converted
   * @returns {Promise<boolean>}
   */
  async recordConversion(clientId, filesCount) {
    try {
      const today = this.getCurrentDate();

      // Atomic upsert
      await this.db.prepare(`
        INSERT INTO daily_usage (client_id, date, files_converted, conversions, updated_at)
        VALUES (?, ?, ?, 1, datetime('now'))
        ON CONFLICT(client_id, date)
        DO UPDATE SET
          files_converted = files_converted + ?,
          conversions = conversions + 1,
          updated_at = datetime('now')
      `).bind(clientId, today, filesCount, filesCount).run();

      return true;
    } catch (error) {
      console.error('Failed to record conversion:', error);
      return false;
    }
  }

  /**
   * Reset usage for a specific client (admin function)
   * @param {string} clientId - Client identifier
   * @param {string} date - Date to reset (defaults to today)
   * @returns {Promise<boolean>}
   */
  async resetUsage(clientId, date = null) {
    try {
      const targetDate = date || this.getCurrentDate();

      await this.db.prepare(`
        DELETE FROM daily_usage
        WHERE client_id = ? AND date = ?
      `).bind(clientId, targetDate).run();

      return true;
    } catch (error) {
      console.error('Failed to reset usage:', error);
      return false;
    }
  }

  /**
   * Clean up old usage data (keep last 30 days)
   * @returns {Promise<number>}
   */
  async cleanup() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 30);
      const cutoff = cutoffDate.toISOString().split('T')[0];

      const result = await this.db.prepare(`
        DELETE FROM daily_usage
        WHERE date < ?
      `).bind(cutoff).run();

      console.log(`Cleaned up ${result.changes} old daily usage records`);
      return result.changes || 0;
    } catch (error) {
      console.error('Failed to cleanup daily usage:', error);
      return 0;
    }
  }

  /**
   * Get usage statistics for analytics
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>}
   */
  async getStats(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days);
      const cutoff = cutoffDate.toISOString().split('T')[0];

      const { results } = await this.db.prepare(`
        SELECT
          date,
          SUM(files_converted) as total_files,
          SUM(conversions) as total_conversions,
          COUNT(DISTINCT client_id) as unique_users,
          AVG(files_converted) as avg_files_per_user,
          COUNT(CASE WHEN files_converted >= ? THEN 1 END) as users_at_limit
        FROM daily_usage
        WHERE date >= ?
        GROUP BY date
        ORDER BY date DESC
      `).bind(this.dailyLimit, cutoff).all();

      return {
        daily: results,
        totalFiles: results.reduce((sum, row) => sum + (row.total_files || 0), 0),
        totalConversions: results.reduce((sum, row) => sum + (row.total_conversions || 0), 0),
        uniqueUsers: new Set(results.map(row => row.unique_users)).size
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return { daily: [], totalFiles: 0, totalConversions: 0, uniqueUsers: 0 };
    }
  }

  /**
   * Get list of users who have hit their daily limit
   * @param {string} date - Date to check (defaults to today)
   * @returns {Promise<Array>}
   */
  async getUsersAtLimit(date = null) {
    try {
      const targetDate = date || this.getCurrentDate();

      const { results } = await this.db.prepare(`
        SELECT client_id, files_converted, conversions
        FROM daily_usage
        WHERE date = ? AND files_converted >= ?
        ORDER BY files_converted DESC
      `).bind(targetDate, this.dailyLimit).all();

      return results;
    } catch (error) {
      console.error('Failed to get users at limit:', error);
      return [];
    }
  }
}
