/**
 * Router configuration with measurements routes
 */

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';

// Lazy load measurement pages for better performance
const MeasurementsPage = React.lazy(() => import('./pages/measurements'));

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