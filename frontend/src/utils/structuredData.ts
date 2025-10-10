/**
 * Schema.org structured data generators for SEO and rich snippets
 * Supports multiple schema types for comprehensive search engine understanding
 */

import type { MeasurementSlug } from '../measurements';

/**
 * Organization schema - describes the website/brand
 */
export function generateOrganizationSchema(): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "TrackerSync",
    "url": "https://trackersync.app",
    "logo": "https://trackersync.app/logo.png",
    "description": "Free tool to convert Fitbit data from Google Takeout to Garmin-compatible .FIT files",
    "sameAs": []
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * SoftwareApplication schema - describes the converter tool
 */
export function generateSoftwareApplicationSchema(): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Fitbit to Garmin Converter",
    "applicationCategory": "UtilityApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    // Note: aggregateRating removed to comply with Google's structured data guidelines
    // Only add back when we have real user reviews with a proper review system
    "description": "Convert your Fitbit health and fitness data to Garmin-compatible .FIT files in seconds. Free, secure, and no account required.",
    "featureList": [
      "Convert weight data from Fitbit to Garmin",
      "Batch processing - up to 3 files at once",
      "No account or signup required",
      "100% client-side conversion for privacy",
      "Maintains data precision and timestamps"
    ],
    "screenshot": "https://trackersync.app/screenshot.png",
    "url": "https://trackersync.app"
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * WebPage schema - describes individual pages
 */
export function generateWebPageSchema(
  url: string,
  name: string,
  description: string
): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": name,
    "description": description,
    "url": url,
    "isPartOf": {
      "@type": "WebSite",
      "name": "TrackerSync",
      "url": "https://trackersync.app"
    },
    "datePublished": "2024-09-18", // Actual TrackerSync launch date
    "dateModified": new Date().toISOString(),
    "inLanguage": "en-US"
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * BreadcrumbList schema - describes navigation hierarchy
 */
export function generateBreadcrumbSchema(
  measurementSlug: MeasurementSlug,
  measurementLabel: string
): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://trackersync.app"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Measurements",
        "item": "https://trackersync.app/measurements"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": measurementLabel,
        "item": `https://trackersync.app/measurements/${measurementSlug}`
      }
    ]
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * HowTo schema - describes step-by-step conversion process
 */
export function generateHowToSchema(measurementType: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `How to Convert Fitbit ${measurementType} to Garmin`,
    "description": `Step-by-step guide to convert your Fitbit ${measurementType.toLowerCase()} data to Garmin format`,
    "totalTime": "PT5M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "tool": [
      {
        "@type": "HowToTool",
        "name": "Fitbit Google Takeout export file"
      },
      {
        "@type": "HowToTool",
        "name": "Garmin Connect account"
      }
    ],
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Upload Fitbit files",
        "text": `Upload your ${measurementType.toLowerCase()} JSON files from Fitbit Google Takeout export`,
        "url": "https://trackersync.app/measurements/weight"
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Convert to Garmin format",
        "text": "Click the Convert button to transform your data to .FIT format",
        "url": "https://trackersync.app/measurements/weight"
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Download .FIT files",
        "text": "Download the converted .FIT files to your device",
        "url": "https://trackersync.app/measurements/weight"
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Import to Garmin Connect",
        "text": "Upload the .FIT files to Garmin Connect through the Import Data feature",
        "url": "https://trackersync.app/measurements/weight"
      }
    ]
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * FAQPage schema - describes FAQ section (already exists in seoCopy.ts)
 * This is a wrapper to maintain consistency
 */
export function generateFAQSchema(faq: Array<{ q: string; a: string }>): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Get all structured data for a measurement page
 */
export function getAllStructuredData(
  measurementSlug: MeasurementSlug,
  measurementLabel: string,
  faq: Array<{ q: string; a: string }>
): {
  organization: string;
  softwareApplication: string;
  webPage: string;
  breadcrumb: string;
  howTo: string;
  faq: string;
} {
  const url = `https://trackersync.app/measurements/${measurementSlug}`;
  const name = `Convert Fitbit ${measurementLabel} to Garmin`;
  const description = `Free tool to convert Fitbit ${measurementLabel.toLowerCase()} data to Garmin-compatible .FIT files`;

  return {
    organization: generateOrganizationSchema(),
    softwareApplication: generateSoftwareApplicationSchema(),
    webPage: generateWebPageSchema(url, name, description),
    breadcrumb: generateBreadcrumbSchema(measurementSlug, measurementLabel),
    howTo: generateHowToSchema(measurementLabel),
    faq: generateFAQSchema(faq)
  };
}
