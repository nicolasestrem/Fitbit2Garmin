/**
 * @file Browser fingerprinting service for abuse prevention.
 * This service uses FingerprintJS and fallback methods to create a unique
 * identifier for the user's browser, which can be used for rate limiting
 * and preventing abuse.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

/**
 * @interface FingerprintData
 * @description Represents the data collected for browser fingerprinting.
 */
export interface FingerprintData {
  fingerprint_hash: string;
  user_agent: string;
  screen_resolution: string;
  timezone: string;
}

/**
 * A service for generating and managing browser fingerprints.
 * It uses a combination of FingerprintJS and custom fallback logic.
 */
class FingerprintService {
  private fingerprintPromise: Promise<any> | null = null;
  private cachedFingerprint: FingerprintData | null = null;

  /**
   * Generates a detailed browser fingerprint.
   * It first tries to use FingerprintJS and falls back to a custom method if it fails.
   * @returns {Promise<FingerprintData>} A promise that resolves to the fingerprint data.
   */
  async generateFingerprint(): Promise<FingerprintData> {
    try {
      if (!this.fingerprintPromise) {
        this.fingerprintPromise = FingerprintJS.load();
      }

      const fp = await this.fingerprintPromise;
      const result = await fp.get();

      const fingerprintData: FingerprintData = {
        fingerprint_hash: result.visitorId,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      return fingerprintData;
    } catch (error) {
      console.error('Error generating fingerprint with FingerprintJS, using fallback:', error);

      // Fallback fingerprint using basic browser properties
      const fallbackData = {
        ua: navigator.userAgent,
        lang: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        canvas: this.getCanvasFingerprint(),
      };

      const fallbackHash = await this.hashString(JSON.stringify(fallbackData));

      return {
        fingerprint_hash: fallbackHash,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
  }

  /**
   * Creates a fingerprint string from the browser's canvas element.
   * This is used as part of the fallback fingerprinting mechanism.
   * @returns {string} A data URL representing the canvas content, or an error string.
   * @private
   */
  private getCanvasFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Fitbit to Garmin Converter 🏃‍♂️', 2, 2);

      ctx.fillStyle = 'rgba(255,0,0,0.5)';
      ctx.fillRect(50, 50, 100, 100);

      return canvas.toDataURL();
    } catch (error) {
      return 'canvas-error';
    }
  }

  /**
   * Hashes a string using the SHA-256 algorithm.
   * Falls back to a simple non-cryptographic hash if the Web Crypto API is unavailable.
   * @param {string} str - The string to hash.
   * @returns {Promise<string>} A promise that resolves to the hex-encoded hash string.
   * @private
   */
  private async hashString(str: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback simple hash if crypto.subtle is not available
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash).toString(16);
    }
  }

  /**
   * Retrieves the fingerprint from a session cache if available,
   * otherwise generates a new one.
   * @returns {Promise<FingerprintData>} A promise that resolves to the cached or new fingerprint data.
   */
  async getCachedFingerprint(): Promise<FingerprintData> {
    if (!this.cachedFingerprint) {
      this.cachedFingerprint = await this.generateFingerprint();
    }
    return this.cachedFingerprint;
  }
}

export const fingerprintService = new FingerprintService();