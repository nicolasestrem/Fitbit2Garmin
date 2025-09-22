/**
 * Google Analytics 4 utility functions
 * Provides type-safe wrappers for gtag functions
 */

declare global {
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
 * Track custom events in Google Analytics
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
 * Track file conversion events
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
 * Track page views (for SPA navigation)
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
 * Track download events
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
 * Track user interactions
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