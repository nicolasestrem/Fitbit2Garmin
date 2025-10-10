/**
 * Main measurements page with tabs layout
 */

import React, { Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { getMeasurement, type MeasurementSlug } from '../../measurements';

// Lazy load page components for code splitting
const pageComponents: Record<MeasurementSlug, React.LazyExoticComponent<React.ComponentType<any>>> = {
  weight: React.lazy(() => import('./WeightPage')),
  'heart-rate': React.lazy(() => import('./HeartRatePage')),
  'body-fat': React.lazy(() => import('./BodyFatPage')),
  bmi: React.lazy(() => import('./BMIPage')),
  steps: React.lazy(() => import('./StepsPage')),
  sleep: React.lazy(() => import('./SleepPage')),
  vo2max: React.lazy(() => import('./VO2MaxPage')),
  hydration: React.lazy(() => import('./HydrationPage')),
  'blood-pressure': React.lazy(() => import('./BloodPressurePage')),
  'resting-heart-rate': React.lazy(() => import('./RestingHeartRatePage'))
};

export default function MeasurementsPage() {
  const { measurement } = useParams();
  const currentSlug = measurement as MeasurementSlug;

  // Validate the slug
  const measurementData = getMeasurement(currentSlug);

  if (!measurementData) {
    return <Navigate to="/measurements/weight" replace />;
  }

  // Get the lazy-loaded page component
  const PageComponent = pageComponents[currentSlug];

  const getPageComponent = () => {
    if (!PageComponent) {
      return <Navigate to="/measurements/weight" replace />;
    }
    return <PageComponent />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Fitbit to Garmin Converter
            </h1>
            <p className="text-gray-600 mt-1">
              Convert your Fitbit data from Google Takeout to Garmin-compatible .fit files
            </p>
          </div>

          {/* Tabs Navigation */}
          <Tabs activeTab={currentSlug} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" role="status" aria-label="loading"></div>
            <span className="ml-4 text-lg font-medium text-gray-700">Loading...</span>
          </div>
        }>
          {getPageComponent()}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              <a
                href="https://fitbit2garmin.app"
                className="hover:text-gray-700 transition-colors"
              >
                Fitbit2Garmin
              </a>
            </div>
            <div>
              <span>Powered by Cloudflare</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
            Independent tool. Not affiliated with Garmin, Fitbit, or Google. Garmin, Fitbit, and Google are trademarks of their respective owners. Mentions are for compatibility only.
          </div>
        </div>
      </footer>
    </div>
  );
}