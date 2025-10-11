/**
 * @file Integration tests for the MeasurementsPage component.
 * @description This suite tests the lazy loading functionality of the MeasurementsPage,
 * ensuring that the Suspense fallback is displayed correctly while the child page
 * component (e.g., WeightPage) is being loaded.
 */
import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import MeasurementsPage from '../src/pages/measurements';
import { server } from './mocks/server';
import { http, HttpResponse } from 'msw';

// Mock the API endpoints that the real WeightPage component calls.
// This allows us to test the integration without actual network requests.
beforeAll(() => {
  server.use(
    http.post('/api/upload', () => {
      return HttpResponse.json({ upload_id: 'mock-upload-id' });
    }),
    http.post('/api/validate', () => {
      return HttpResponse.json([{ filename: 'test.json', is_valid: true }]);
    }),
    http.post('/api/convert', () => {
      return HttpResponse.json({ conversion_id: 'mock-convert-id', download_urls: [] });
    })
  );
});

describe('MeasurementsPage', () => {
  /**
   * Renders the MeasurementsPage component within a test environment,
   * including providers for routing and helmet.
   * @param {string} initialEntry - The initial URL path for the MemoryRouter.
   * @returns {import('@testing-library/react').RenderResult} The result from React Testing Library's render function.
   */
  const renderComponent = (initialEntry: string) => {
    return render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/measurements/:measurement" element={<MeasurementsPage />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );
  };

  test('should render fallback and then the actual WeightPage component', async () => {
    renderComponent('/measurements/weight');

    // Check for the Suspense fallback UI first
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

    // Wait for the lazy-loaded WeightPage component to render and check for its actual content
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Upload Your Weight Data/i })).toBeInTheDocument();
    });
  });
});