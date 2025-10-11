/**
 * @file Application router configuration.
 * This file defines the URL routes for the application using `react-router-dom`.
 * It sets up the main application layout and handles navigation for different measurement pages.
 */

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';

// Lazy load the main measurements page component for code-splitting and better initial load performance.
const MeasurementsPage = React.lazy(() => import('./pages/measurements'));

/**
 * The application's router object.
 * It defines the routing structure, including a root path that redirects to the default
 * weight measurement page, a dynamic route for specific measurements, and a wildcard
 * fallback to the default page.
 * @type {ReturnType<typeof createBrowserRouter>}
 */
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