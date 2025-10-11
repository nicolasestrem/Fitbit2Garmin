/**
 * @file Google Analytics 4 utility functions.
 * This file provides type-safe wrappers for sending events to Google Analytics (GA4)
 * using the `gtag.js` library.
 */

declare global {
  /**
   * Extends the global Window interface to include `gtag` and `dataLayer`
   * for Google Analytics integration.
   */
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'consent',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer: any[];
  }
}

/**
 * Tracks a custom event in Google Analytics. This is a generic event tracking function.
 * @param {string} eventName - The name of the event to track.
 * @param {object} [parameters] - Optional parameters to send with the event.
 * @param {string} [parameters.event_category] - The category of the event.
 * @param {string} [parameters.event_label] - The label for the event.
 * @param {number} [parameters.value] - A numerical value associated with the event.
 * @returns {void}
 */
export function trackEvent(
  eventName: string,
  parameters?: {
    event_category?: string;
    event_label?: string;
    value?: number;
    [key: string]: any;
  }
): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
}

/**
 * Tracks a file conversion event.
 * @param {'weight' | 'heart-rate' | 'other'} conversionType - The type of data being converted.
 * @param {number} [fileSize] - The size of the file in bytes, to be used as the event value.
 * @returns {void}
 */
export function trackFileConversion(
  conversionType: 'weight' | 'heart-rate' | 'other',
  fileSize?: number
): void {
  trackEvent('file_conversion', {
    event_category: 'engagement',
    event_label: conversionType,
    value: fileSize,
    conversion_type: conversionType,
  });
}

/**
 * Tracks a page view, typically for Single Page Application (SPA) navigation changes.
 * @param {string} pageTitle - The title of the page being viewed.
 * @param {string} pagePath - The path of the page being viewed (e.g., '/measurements/weight').
 * @returns {void}
 */
export function trackPageView(pageTitle: string, pagePath: string): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-97H8KS2QQ8', {
      page_title: pageTitle,
      page_location: window.location.href,
      page_path: pagePath,
    });
  }
}

/**
 * Tracks a file download event.
 * @param {string} fileName - The name of the downloaded file.
 * @param {string} fileType - The type or extension of the file (e.g., '.fit').
 * @returns {void}
 */
export function trackDownload(fileName: string, fileType: string): void {
  trackEvent('file_download', {
    event_category: 'engagement',
    event_label: fileType,
    file_name: fileName,
    file_type: fileType,
  });
}

/**
 * Tracks a generic user interaction, such as a button click.
 * @param {string} action - The action performed by the user (e.g., 'click').
 * @param {string} target - The UI element or component that was interacted with (e.g., 'ConvertButton').
 * @param {number} [value] - An optional numerical value for the interaction.
 * @returns {void}
 */
export function trackUserInteraction(
  action: string,
  target: string,
  value?: number
): void {
  trackEvent('user_interaction', {
    event_category: 'engagement',
    event_label: target,
    value,
    action,
    target,
  });
}