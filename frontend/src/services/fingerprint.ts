/**
 * Browser fingerprinting service for abuse prevention
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

export interface FingerprintData {
  fingerprint_hash: string;
  user_agent: string;
  screen_resolution: string;
  timezone: string;
}

class FingerprintService {
  private fingerprintPromise: Promise<any> | null = null;

  async generateFingerprint(): Promise<FingerprintData> {
    try {
      // Initialize FingerprintJS if not already done
      if (!this.fingerprintPromise) {
        this.fingerprintPromise = FingerprintJS.load();
      }

      const fp = await this.fingerprintPromise;
      const result = await fp.get();

      // Generate composite fingerprint data
      const fingerprintData: FingerprintData = {
        fingerprint_hash: result.visitorId,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      return fingerprintData;
    } catch (error) {
      console.error('Error generating fingerprint:', error);

      // Fallback fingerprint using basic browser properties
      const fallbackData = {
        ua: navigator.userAgent,
        lang: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        canvas: this.getCanvasFingerprint(),
      };

      const fallbackHash = await this.hashString(JSON.stringify(fallbackData));

      return {
        fingerprint_hash: fallbackHash,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
  }

  private getCanvasFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      // Draw some text and shapes for fingerprinting
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

  // Cache fingerprint for session
  private cachedFingerprint: FingerprintData | null = null;

  async getCachedFingerprint(): Promise<FingerprintData> {
    if (!this.cachedFingerprint) {
      this.cachedFingerprint = await this.generateFingerprint();
    }
    return this.cachedFingerprint;
  }
}

export const fingerprintService = new FingerprintService();