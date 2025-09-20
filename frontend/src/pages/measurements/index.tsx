/**
 * Main measurements page with tabs layout
 */

import React, { Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { getMeasurement, type MeasurementSlug } from '../../measurements';
// Import page components directly
import WeightPage from './WeightPage';
import HeartRatePage from './HeartRatePage';
import BodyFatPage from './BodyFatPage';
import BMIPage from './BMIPage';
import StepsPage from './StepsPage';
import SleepPage from './SleepPage';
import VO2MaxPage from './VO2MaxPage';
import HydrationPage from './HydrationPage';
import BloodPressurePage from './BloodPressurePage';
import RestingHeartRatePage from './RestingHeartRatePage';

export default function MeasurementsPage() {
  const { measurement } = useParams();
  const currentSlug = measurement as MeasurementSlug;

  // Debug logging
  console.log('MeasurementsPage rendered with measurement:', measurement);
  console.log('Current slug:', currentSlug);

  // Validate the slug
  const measurementData = getMeasurement(currentSlug);
  console.log('Measurement data:', measurementData);

  if (!measurementData) {
    console.log('Invalid measurement, redirecting to weight');
    return <Navigate to="/measurements/weight" replace />;
  }

  // Component mapping
  const getPageComponent = () => {
    switch (currentSlug) {
      case 'weight':
        return <WeightPage />;
      case 'heart-rate':
        return <HeartRatePage />;
      case 'body-fat':
        return <BodyFatPage />;
      case 'bmi':
        return <BMIPage />;
      case 'steps':
        return <StepsPage />;
      case 'sleep':
        return <SleepPage />;
      case 'vo2max':
        return <VO2MaxPage />;
      case 'hydration':
        return <HydrationPage />;
      case 'blood-pressure':
        return <BloodPressurePage />;
      case 'resting-heart-rate':
        return <RestingHeartRatePage />;
      default:
        return <Navigate to="/measurements/weight" replace />;
    }
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
        </div>
      </footer>
    </div>
  );
}