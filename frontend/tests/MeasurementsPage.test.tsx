/**
 * Test suite for the MeasurementsPage component and its lazy loading.
 */
import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  const renderComponent = (initialEntry: string) => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/measurements/:measurement" element={<MeasurementsPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );
  };

  test('should render fallback and then the actual WeightPage component', async () => {
    renderComponent('/measurements/weight');

    // Check for the Suspense fallback UI first
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for the lazy-loaded WeightPage component to render and check for its actual content
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Upload Your Weight Data/i })).toBeInTheDocument();
    });
  });
});