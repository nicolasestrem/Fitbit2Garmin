import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { router } from './router';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <RouterProvider router={router} />
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);