/**
 * @file Comprehensive SEO metadata generator for all pages.
 * This utility creates and formats metadata for use with `react-helmet-async`,
 * including title, description, canonical links, OpenGraph tags, and Twitter Cards.
 */

import type { MeasurementSlug } from '../measurements';

/**
 * @interface SEOMetadata
 * @description Defines the complete set of SEO metadata for a page.
 */
export interface SEOMetadata {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogType: string;
  ogImage: string;
  ogImageAlt: string;
  ogSiteName: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
  author?: string;
  keywords?: string;
  applicationName: string;
}

/**
 * @constant {object} BASE_METADATA
 * @description Base metadata values that are consistent across all pages.
 */
const BASE_METADATA = {
  ogSiteName: 'TrackerSync',
  applicationName: 'TrackerSync',
  author: 'TrackerSync',
  twitterCard: 'summary_large_image'
};

/**
 * @constant {string} FALLBACK_OG_IMAGE
 * @description The default OpenGraph image (1200x630px) to be used when a specific one isn't available.
 */
const FALLBACK_OG_IMAGE = 'https://trackersync.app/og-images/default-og.png';

/**
 * Generates SEO metadata for a specific measurement page.
 * @param {MeasurementSlug} slug - The slug of the measurement.
 * @param {string} pageTitle - The title for the page.
 * @param {string} pageDescription - The meta description for the page.
 * @returns {SEOMetadata} The complete SEO metadata object for the page.
 */
export function getMeasurementMetadata(
  slug: MeasurementSlug,
  pageTitle: string,
  pageDescription: string
): SEOMetadata {
  const url = `https://trackersync.app/measurements/${slug}`;
  const ogImage = FALLBACK_OG_IMAGE;
  const ogImageAlt = `TrackerSync - Convert Fitbit ${slug} to Garmin`;
  const keywords = generateKeywords(slug);

  return {
    title: pageTitle,
    description: pageDescription,
    canonical: url,
    ogTitle: pageTitle,
    ogDescription: pageDescription,
    ogUrl: url,
    ogType: 'website',
    ogImage: ogImage,
    ogImageAlt: ogImageAlt,
    ogSiteName: BASE_METADATA.ogSiteName,
    twitterCard: BASE_METADATA.twitterCard,
    twitterTitle: pageTitle,
    twitterDescription: pageDescription,
    twitterImage: ogImage,
    twitterImageAlt: ogImageAlt,
    author: BASE_METADATA.author,
    keywords: keywords,
    applicationName: BASE_METADATA.applicationName
  };
}

/**
 * Generates SEO metadata for the home page.
 * @returns {SEOMetadata} The complete SEO metadata object for the home page.
 */
export function getHomeMetadata(): SEOMetadata {
  const title = 'Free Fitbit to Garmin Converter | Google Takeout to FIT Files';
  const description = 'Convert Fitbit data to Garmin in seconds. Free tool transforms Google Takeout JSON to .FIT files. Weight, heart rate, sleep, steps & more. No signup required.';
  const url = 'https://trackersync.app';
  const ogImage = FALLBACK_OG_IMAGE;
  const keywords = 'fitbit to garmin, fitbit converter, google takeout, fit file converter, fitbit export, garmin import, health data migration, fitness tracker switch';

  return {
    title,
    description,
    canonical: url,
    ogTitle: title,
    ogDescription: description,
    ogUrl: url,
    ogType: 'website',
    ogImage: ogImage,
    ogImageAlt: 'TrackerSync converter homepage',
    ogSiteName: BASE_METADATA.ogSiteName,
    twitterCard: BASE_METADATA.twitterCard,
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
    twitterImageAlt: 'TrackerSync converter homepage',
    author: BASE_METADATA.author,
    keywords: keywords,
    applicationName: BASE_METADATA.applicationName
  };
}

/**
 * Generates a string of relevant keywords for a measurement page.
 * @param {MeasurementSlug} slug - The slug of the measurement.
 * @returns {string} A comma-separated string of keywords.
 */
function generateKeywords(slug: MeasurementSlug): string {
  const baseKeywords = 'fitbit to garmin, fitbit converter, google takeout, fit file, garmin connect, data migration, fitness tracker, health data transfer, wearable data sync, fitness data export';

  const slugKeywords: Record<MeasurementSlug, string> = {
    'weight': 'weight data, weight tracking, aria scale, garmin index scale, body composition, weight loss, body weight transfer, health metrics',
    'heart-rate': 'heart rate data, hr zones, cardio data, heart rate monitoring, fitness tracking, cardiovascular metrics, training zones',
    'steps': 'step count, daily steps, activity data, step tracking, walking data, activity history, pedometer data',
    'sleep': 'sleep data, sleep stages, sleep tracking, sleep quality, rem sleep, deep sleep, sleep analysis, rest patterns',
    'vo2max': 'vo2 max, cardio fitness, aerobic capacity, fitness level, endurance, fitness assessment, athletic performance',
    'blood-pressure': 'blood pressure, bp tracking, cardiovascular health, systolic, diastolic, health monitoring, vital signs'
  };

  return `${baseKeywords}, ${slugKeywords[slug]}`;
}

/**
 * Formats the SEOMetadata object into a structure compatible with `react-helmet-async`.
 * @param {SEOMetadata} metadata - The metadata object to format.
 * @returns {{title: string, link: Array<object>, meta: Array<object>}} An object containing title, link, and meta tags for the helmet.
 */
export function formatMetadataForHelmet(metadata: SEOMetadata) {
  return {
    title: metadata.title,
    link: [
      { rel: 'canonical', href: metadata.canonical }
    ],
    meta: [
      { name: 'description', content: metadata.description },
      { name: 'author', content: metadata.author },
      { name: 'keywords', content: metadata.keywords },
      { name: 'application-name', content: metadata.applicationName },

      // OpenGraph tags
      { property: 'og:title', content: metadata.ogTitle },
      { property: 'og:description', content: metadata.ogDescription },
      { property: 'og:url', content: metadata.ogUrl },
      { property: 'og:type', content: metadata.ogType },
      { property: 'og:image', content: metadata.ogImage },
      { property: 'og:image:alt', content: metadata.ogImageAlt },
      { property: 'og:site_name', content: metadata.ogSiteName },

      // Twitter Card tags
      { name: 'twitter:card', content: metadata.twitterCard },
      { name: 'twitter:title', content: metadata.twitterTitle },
      { name: 'twitter:description', content: metadata.twitterDescription },
      { name: 'twitter:image', content: metadata.twitterImage },
      { name: 'twitter:image:alt', content: metadata.twitterImageAlt }
    ]
  };
}
