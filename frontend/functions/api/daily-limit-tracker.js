/**
 * @file Daily Limit Tracker
 * @description Enforces a daily file conversion limit for free tier users.
 * This class uses a D1 database to track usage per client, resetting daily at midnight UTC.
 */

/**
 * Manages daily usage limits for file conversions.
 */
export class DailyLimitTracker {
  /**
   * Creates an instance of DailyLimitTracker.
   * @param {object} env - The Cloudflare environment object.
   * @param {D1Database} env.RATE_LIMITS_DB - The D1 database for storing usage data.
   */
  constructor(env) {
    this.db = env.RATE_LIMITS_DB;
    this.dailyLimit = 3; // 3 files per day for free users.
  }

  /**
   * Gets the current date in YYYY-MM-DD format based on UTC.
   * Daily limits reset at midnight UTC (00:00 UTC).
   * @returns {string} The current UTC date string.
   */
  getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Retrieves the usage data for a given client for the current day.
   * @param {string} clientId - The unique identifier for the client.
   * @returns {Promise<object>} A promise that resolves to an object containing
   * usage details like files converted, remaining, and reset time.
   */
  async getUsage(clientId) {
    try {
      const today = this.getCurrentDate();
      const { results } = await this.db.prepare(
        `SELECT files_converted, conversions, updated_at FROM daily_usage WHERE client_id = ? AND date = ?`
      ).bind(clientId, today).all();

      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const resetTime = Math.floor(tomorrow.getTime() / 1000);

      if (results.length === 0) {
        return { filesConverted: 0, conversions: 0, filesRemaining: this.dailyLimit, resetTime, date: today };
      }

      const usage = results[0];
      return {
        filesConverted: usage.files_converted || 0,
        conversions: usage.conversions || 0,
        filesRemaining: Math.max(0, this.dailyLimit - (usage.files_converted || 0)),
        resetTime,
        date: today
      };
    } catch (error) {
      console.error('Failed to get daily usage:', error);
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      return {
        filesConverted: 0, conversions: 0, filesRemaining: this.dailyLimit,
        resetTime: Math.floor(tomorrow.getTime() / 1000), date: this.getCurrentDate(), error: true
      };
    }
  }

  /**
   * Checks if a client is allowed to convert a given number of files based on their daily limit.
   * @param {string} clientId - The client identifier.
   * @param {number} filesCount - The number of files the client wants to convert.
   * @returns {Promise<object>} An object indicating if the conversion is allowed and usage details.
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
   * Records a conversion by incrementing the usage counters for a client.
   * This operation is an atomic "upsert" (insert or update).
   * @param {string} clientId - The client identifier.
   * @param {number} filesCount - The number of files that were converted.
   * @returns {Promise<boolean>} True if the record was saved successfully, false otherwise.
   */
  async recordConversion(clientId, filesCount) {
    try {
      const today = this.getCurrentDate();
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
   * Resets the usage for a specific client. This is intended for administrative purposes.
   * @param {string} clientId - The client identifier.
   * @param {string|null} [date=null] - The specific date to reset (YYYY-MM-DD). Defaults to the current day.
   * @returns {Promise<boolean>} True if the usage was reset successfully, false otherwise.
   */
  async resetUsage(clientId, date = null) {
    try {
      const targetDate = date || this.getCurrentDate();
      await this.db.prepare(`DELETE FROM daily_usage WHERE client_id = ? AND date = ?`).bind(clientId, targetDate).run();
      return true;
    } catch (error) {
      console.error('Failed to reset usage:', error);
      return false;
    }
  }

  /**
   * Cleans up old usage data from the database, retaining the last 30 days.
   * @returns {Promise<number>} The number of rows deleted.
   */
  async cleanup() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 30);
      const cutoff = cutoffDate.toISOString().split('T')[0];
      const result = await this.db.prepare(`DELETE FROM daily_usage WHERE date < ?`).bind(cutoff).run();
      console.log(`Cleaned up ${result.changes} old daily usage records`);
      return result.changes || 0;
    } catch (error) {
      console.error('Failed to cleanup daily usage:', error);
      return 0;
    }
  }

  /**
   * Retrieves usage statistics for analytics purposes.
   * @param {number} [days=7] - The number of past days to include in the stats.
   * @returns {Promise<object>} An object containing aggregated daily statistics.
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
   * Gets a list of clients who have reached or exceeded their daily conversion limit.
   * @param {string|null} [date=null] - The date to check (YYYY-MM-DD). Defaults to the current day.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of clients at the limit.
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
