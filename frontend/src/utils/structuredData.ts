/**
 * @file Schema.org structured data generators for SEO and rich snippets.
 * This utility provides functions to create various types of JSON-LD structured data,
 * which helps search engines understand the content and context of the pages.
 */

import type { MeasurementSlug } from '../measurements';

/**
 * Generates the JSON-LD for the `Organization` schema.
 * This describes the website/brand.
 * @returns {string} A JSON string representing the Organization schema.
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
 * Generates the JSON-LD for the `SoftwareApplication` schema.
 * This describes the converter tool itself.
 * @returns {string} A JSON string representing the SoftwareApplication schema.
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
 * Generates the JSON-LD for the `WebPage` schema.
 * This describes an individual page.
 * @param {string} url - The canonical URL of the page.
 * @param {string} name - The title of the page.
 * @param {string} description - The meta description of the page.
 * @returns {string} A JSON string representing the WebPage schema.
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
    "datePublished": "2024-09-18",
    "dateModified": new Date().toISOString(),
    "inLanguage": "en-US"
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generates the JSON-LD for the `BreadcrumbList` schema.
 * This describes the navigation hierarchy of the page.
 * @param {MeasurementSlug} measurementSlug - The slug of the current measurement.
 * @param {string} measurementLabel - The display label of the current measurement.
 * @returns {string} A JSON string representing the BreadcrumbList schema.
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
 * Generates the JSON-LD for the `HowTo` schema.
 * This describes the step-by-step process of using the converter.
 * @param {string} measurementType - The display name of the measurement (e.g., "Weight").
 * @param {MeasurementSlug} measurementSlug - The slug of the measurement.
 * @returns {string} A JSON string representing the HowTo schema.
 */
export function generateHowToSchema(measurementType: string, measurementSlug: MeasurementSlug): string {
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
        "url": `https://trackersync.app/measurements/${measurementSlug}`
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Convert to Garmin format",
        "text": "Click the Convert button to transform your data to .FIT format",
        "url": `https://trackersync.app/measurements/${measurementSlug}`
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Download .FIT files",
        "text": "Download the converted .FIT files to your device",
        "url": `https://trackersync.app/measurements/${measurementSlug}`
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Import to Garmin Connect",
        "text": "Upload the .FIT files to Garmin Connect through the Import Data feature",
        "url": `https://trackersync.app/measurements/${measurementSlug}`
      }
    ]
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generates the JSON-LD for the `FAQPage` schema.
 * This is a wrapper for consistency, as the primary generation might be elsewhere.
 * @param {Array<{ q: string; a: string }>} faq - An array of question-answer objects.
 * @returns {string} A JSON string representing the FAQPage schema.
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
 * Compiles all relevant structured data for a measurement page into a single object.
 * @param {MeasurementSlug} measurementSlug - The slug of the measurement.
 * @param {string} measurementLabel - The display label of the measurement.
 * @param {Array<{ q: string; a: string }>} faq - The FAQ data for the page.
 * @returns {{organization: string, softwareApplication: string, webPage: string, breadcrumb: string, howTo: string, faq: string}} An object containing all generated JSON-LD strings.
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
    howTo: generateHowToSchema(measurementLabel, measurementSlug),
    faq: generateFAQSchema(faq)
  };
}
