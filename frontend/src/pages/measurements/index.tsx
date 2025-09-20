/**
 * Main measurements page with tabs layout
 */

import React, { Suspense } from 'react';
import { Outlet, useParams, Navigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { getMeasurement, type MeasurementSlug } from '../../measurements';

export default function MeasurementsPage() {
  const { '*': slug } = useParams();
  const currentSlug = slug as MeasurementSlug;

  // Validate the slug
  const measurement = getMeasurement(currentSlug);
  if (!measurement) {
    return <Navigate to="/measurements/weight" replace />;
  }

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
          <Outlet />
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