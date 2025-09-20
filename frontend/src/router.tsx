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
const BodyFatPage = React.lazy(() => import('./pages/measurements/BodyFatPage'));
const BMIPage = React.lazy(() => import('./pages/measurements/BMIPage'));
const StepsPage = React.lazy(() => import('./pages/measurements/StepsPage'));
const SleepPage = React.lazy(() => import('./pages/measurements/SleepPage'));
const VO2MaxPage = React.lazy(() => import('./pages/measurements/VO2MaxPage'));
const HydrationPage = React.lazy(() => import('./pages/measurements/HydrationPage'));
const BloodPressurePage = React.lazy(() => import('./pages/measurements/BloodPressurePage'));
const RestingHeartRatePage = React.lazy(() => import('./pages/measurements/RestingHeartRatePage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '/',
        element: <Navigate to="/measurements/weight" replace />
      },
      {
        path: 'measurements',
        element: <MeasurementsPage />,
        children: [
          {
            path: '',
            element: <Navigate to="weight" replace />
          },
          {
            path: 'weight',
            element: <WeightPage />
          },
          {
            path: 'heart-rate',
            element: <HeartRatePage />
          },
          {
            path: 'body-fat',
            element: <BodyFatPage />
          },
          {
            path: 'bmi',
            element: <BMIPage />
          },
          {
            path: 'steps',
            element: <StepsPage />
          },
          {
            path: 'sleep',
            element: <SleepPage />
          },
          {
            path: 'vo2max',
            element: <VO2MaxPage />
          },
          {
            path: 'hydration',
            element: <HydrationPage />
          },
          {
            path: 'blood-pressure',
            element: <BloodPressurePage />
          },
          {
            path: 'resting-heart-rate',
            element: <RestingHeartRatePage />
          }
        ]
      },
      {
        path: '*',
        element: <Navigate to="/measurements/weight" replace />
      }
    ]
  }
]);