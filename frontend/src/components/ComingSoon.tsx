/**
 * Reusable "Coming Soon" component for measurement pages
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getSeoCopy } from '../utils/seoCopy';
import { getMeasurementMetadata, formatMetadataForHelmet } from '../utils/seoMetadata';
import { getAllStructuredData } from '../utils/structuredData';
import type { MeasurementSlug } from '../measurements';

interface ComingSoonProps {
  measurementSlug: MeasurementSlug;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({ measurementSlug }) => {
  const seoContent = getSeoCopy(measurementSlug);

  // Get measurement label for structured data
  const measurementLabels: Record<MeasurementSlug, string> = {
    'weight': 'Weight',
    'heart-rate': 'Heart Rate',
    'steps': 'Steps',
    'sleep': 'Sleep',
    'vo2max': 'VO2 Max',
    'blood-pressure': 'Blood Pressure',
    'resting-heart-rate': 'Resting Heart Rate'
  };
  const measurementLabel = measurementLabels[measurementSlug];

  const metadata = getMeasurementMetadata(measurementSlug, seoContent.title, seoContent.description);
  const helmetMetadata = formatMetadataForHelmet(metadata);
  const structuredData = getAllStructuredData(measurementSlug, measurementLabel, seoContent.faq);

  // Generate example filename for the measurement
  const getExampleFilename = (slug: MeasurementSlug): string => {
    const filenameMap: Record<MeasurementSlug, string> = {
      'weight': 'weight-2024-01-15.json',
      'heart-rate': 'heart_rate-2024-01-15.json',
      'steps': 'steps-2024-01-15.json',
      'sleep': 'sleep-2024-01-15.json',
      'vo2max': 'vo2_max-2024-01-15.json',
      'blood-pressure': 'blood_pressure-2024-01-15.json',
      'resting-heart-rate': 'resting_heart_rate-2024-01-15.json'
    };
    return filenameMap[slug];
  };

  return (
    <>
      <Helmet
        title={helmetMetadata.title}
        link={helmetMetadata.link}
        meta={helmetMetadata.meta}
      >
        {/* Structured Data - Multiple schemas for rich snippets */}
        <script type="application/ld+json">{structuredData.organization}</script>
        <script type="application/ld+json">{structuredData.softwareApplication}</script>
        <script type="application/ld+json">{structuredData.webPage}</script>
        <script type="application/ld+json">{structuredData.breadcrumb}</script>
        <script type="application/ld+json">{structuredData.howTo}</script>
        <script type="application/ld+json">{structuredData.faq}</script>
      </Helmet>

      <div className="max-w-4xl mx-auto">
        {/* Quick Answer - AIO Optimization */}
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <h2 className="text-sm font-semibold text-blue-900 mb-2">Quick Answer</h2>
          <p className="text-blue-800 leading-relaxed">{seoContent.quickAnswer}</p>
        </div>

        {/* Key Features - AIO Optimization */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Key Features</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {seoContent.keyFeatures.map((feature, index) => (
              <li key={index} className="flex items-start text-sm text-gray-700">
                <span className="text-green-600 mr-2">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Main heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          {seoContent.h1}
        </h1>

        {/* Description paragraphs */}
        <div className="prose prose-lg text-gray-600 mb-8">
          {seoContent.paragraphs.map((paragraph, index) => (
            <p key={index} className="mb-4">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Coming Soon Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Get notified when ready
            </h2>
            <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
              Coming Soon
            </span>
          </div>

          {/* Email capture (disabled) */}
          <div className="flex gap-3 mb-4">
            <input
              type="email"
              placeholder="Enter your email address"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
              disabled
              aria-describedby="email-help"
            />
            <div className="relative">
              <button
                className="px-6 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
                disabled
                title="Coming soon"
                aria-describedby="notify-tooltip"
              >
                Notify me
              </button>
              <div
                id="notify-tooltip"
                className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none"
              >
                Coming soon
              </div>
            </div>
          </div>
          <p id="email-help" className="text-sm text-gray-500">
            We'll email you when {measurementSlug.replace('-', ' ')} import is available.
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              to="/measurements/weight"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              See how Weight import works
            </Link>
            <Link
              to="/measurements/weight"
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Read documentation
            </Link>
          </div>
        </div>

        {/* Example filename */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Expected file format from Google Takeout:
          </h3>
          <code className="block bg-blue-100 text-blue-800 px-3 py-2 rounded font-mono text-sm">
            {getExampleFilename(measurementSlug)}
          </code>
          <p className="text-xs text-blue-700 mt-2">
            This converter will support files from Fitbit's Global Export Data folder.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {seoContent.faq.map((item, index) => (
              <div key={index} className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {item.q}
                </h3>
                <p className="text-gray-600">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-measurement navigation */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Explore other measurements
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link
              to="/measurements/weight"
              className="p-3 text-center bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
            >
              <div className="font-medium text-green-900">Weight</div>
              <div className="text-xs text-green-600">Available now</div>
            </Link>
            <Link
              to="/measurements/heart-rate"
              className="p-3 text-center bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="font-medium text-gray-900">Heart Rate</div>
              <div className="text-xs text-gray-600">Coming soon</div>
            </Link>
            <Link
              to="/measurements/sleep"
              className="p-3 text-center bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="font-medium text-gray-900">Sleep</div>
              <div className="text-xs text-gray-600">Coming soon</div>
            </Link>
            <Link
              to="/measurements/steps"
              className="p-3 text-center bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="font-medium text-gray-900">Steps</div>
              <div className="text-xs text-gray-600">Coming soon</div>
            </Link>
            <Link
              to="/measurements/vo2max"
              className="p-3 text-center bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="font-medium text-gray-900">VO2 Max</div>
              <div className="text-xs text-gray-600">Coming soon</div>
            </Link>
            <Link
              to="/measurements"
              className="p-3 text-center bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              <div className="font-medium text-blue-900">View All</div>
              <div className="text-xs text-blue-600">See complete list</div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};