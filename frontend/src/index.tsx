/**
 * @file Main entry point for the React application.
 * This file sets up the root of the application, including the router,
 * error boundaries, and other global providers, and renders it into the DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { router } from './router';

// Get the root DOM element where the React app will be mounted.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find the root element to mount the application.");
}

const root = ReactDOM.createRoot(rootElement);

// Render the main application component tree.
root.render(
  <React.StrictMode>
    {/* ErrorBoundary catches runtime errors in the component tree and displays a fallback UI. */}
    <ErrorBoundary>
      {/* HelmetProvider provides context for managing changes to the document head (e.g., title, meta tags). */}
      <HelmetProvider>
        {/* RouterProvider provides the routing context to the application. */}
        <RouterProvider router={router} />
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);