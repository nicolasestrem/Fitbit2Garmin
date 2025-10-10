/**
 * Router configuration with measurements routes
 */

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';

// Lazy load measurement pages for better performance
const MeasurementsPage = React.lazy(() => import('./pages/measurements'));
const WeightPage = React.lazy(() => import('./pages/measurements/WeightPage'));
const HeartRatePage = React.lazy(() => import('./pages/measurements/HeartRatePage'));
const StepsPage = React.lazy(() => import('./pages/measurements/StepsPage'));
const SleepPage = React.lazy(() => import('./pages/measurements/SleepPage'));
const VO2MaxPage = React.lazy(() => import('./pages/measurements/VO2MaxPage'));
const BloodPressurePage = React.lazy(() => import('./pages/measurements/BloodPressurePage'));
const RestingHeartRatePage = React.lazy(() => import('./pages/measurements/RestingHeartRatePage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '',
        element: <Navigate to="/measurements/weight" replace />
      },
      {
        path: 'measurements/:measurement',
        element: <MeasurementsPage />
      },
      {
        path: 'measurements',
        element: <Navigate to="/measurements/weight" replace />
      },
      {
        path: '*',
        element: <Navigate to="/measurements/weight" replace />
      }
    ]
  }
]);