/**
 * Weight measurement page - extracted from original App.tsx logic
 */

import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { FileUpload } from '../../components/FileUpload';
import { ConversionProgress } from '../../components/ConversionProgress';
import { DownloadManager } from '../../components/DownloadManager';
import { apiService, ConversionResponse, FileValidationResult } from '../../services/api';
import { getSeoCopy } from '../../utils/seoCopy';

type AppState = 'idle' | 'loading' | 'uploading' | 'validating' | 'converting' | 'completed' | 'error' | 'partial_success';

const wait = (durationMs: number) => new Promise<void>((resolve) => setTimeout(resolve, durationMs));

export default function WeightPage() {
  const [state, setState] = useState<AppState>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conversionResponse, setConversionResponse] = useState<ConversionResponse | null>(null);
  const [validationResults, setValidationResults] = useState<FileValidationResult[]>([]);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [retryAfter, setRetryAfter] = useState<number>(0);

  const seoContent = getSeoCopy('weight');

  // Initialize fingerprint on component load
  useEffect(() => {
    // Fingerprint initialization is commented out in original App.tsx
    // Keeping the same structure for consistency
  }, []);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setError('');
  };

  const resetState = () => {
    setState('idle');
    setConversionResponse(null);
    setValidationResults([]);
    setError('');
    setProgress(0);
    setRetryAfter(0);
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select files to convert.');
      return;
    }

    try {
      // Step 1: Upload files
      setState('uploading');
      setProgress(15);
      const uploadResult = await apiService.uploadFiles(selectedFiles);

      // Step 2: Validate files
      setState('validating');
      setProgress(35);
      const validationResult = await apiService.validateFiles(uploadResult.upload_id);
      setValidationResults(validationResult);

      // Check if all files are valid
      const hasInvalidFiles = validationResult.some(result => !result.is_valid);
      if (hasInvalidFiles) {
        setError('Some files have validation errors. Please check the details below.');
        setState('error');
        return;
      }

      // Step 3: Convert files
      setState('converting');
      setProgress(70);
      const conversionResult = await apiService.convertFiles(uploadResult.upload_id);
      setConversionResponse(conversionResult);

      // Step 4: Complete
      setProgress(100);
      if (conversionResult.partial_success) {
        setState('partial_success');
      } else {
        setState('completed');
      }

    } catch (error) {
      console.error('Conversion failed:', error);

      // Extract retry information for rate limiting
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        const match = error.message.match(/wait (\d+) minute/);
        if (match) {
          setRetryAfter(parseInt(match[1]) * 60);
        }
      }

      setError(error instanceof Error ? error.message : 'Conversion failed');
      setState('error');
    }
  };

  const canConvert = selectedFiles.length > 0 && state === 'idle';

  return (
    <>
      <Helmet>
        <title>{seoContent.title}</title>
        <meta name="description" content={seoContent.description} />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {seoContent.h1}
          </h1>
          <p className="text-gray-600">
            Convert your Fitbit weight data to Garmin-compatible .fit files
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
                {error.includes('connect to server') && (
                  <div className="mt-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Try refreshing the page
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* File Upload Section */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Upload Your Weight Data
            </h2>
            <FileUpload
              onFilesSelected={handleFilesSelected}
              maxFiles={3}
              disabled={state !== 'idle'}
            />
          </section>

          {/* Convert Button */}
          {selectedFiles.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  2. Convert to Garmin Format
                </h2>
                <div className="space-x-3">
                  {state !== 'idle' && state !== 'completed' && (
                    <button
                      onClick={resetState}
                      className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleConvert}
                    disabled={!canConvert}
                    className={`
                      px-6 py-2 rounded-md font-medium transition-colors
                      ${canConvert
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {state === 'idle' ? 'Convert Files' : 'Converting...'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Validation Results */}
          {validationResults.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                File Validation Results
              </h2>
              <div className="space-y-3">
                {validationResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.is_valid
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        {result.is_valid ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-400" />
                        ) : (
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className={`text-sm font-medium ${
                          result.is_valid ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {result.filename}
                        </h3>
                        {result.is_valid ? (
                          <div className="mt-1 text-sm text-green-700">
                            <p>✓ Valid format</p>
                            {result.entry_count && <p>✓ {result.entry_count} entries found</p>}
                            {result.date_range && <p>✓ Date range: {result.date_range}</p>}
                            {result.size_kb && <p>✓ Size: {result.size_kb}KB</p>}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-red-700">
                            {result.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Progress Section */}
          <ConversionProgress
            status={state}
            progress={progress}
            error={error}
          />

          {/* Partial Success Warning */}
          {state === 'partial_success' && conversionResponse && (
            <section>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Partial Success
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>{conversionResponse.message}</p>
                      {conversionResponse.errors && conversionResponse.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Failed files:</p>
                          <ul className="mt-1 list-disc list-inside">
                            {conversionResponse.errors.map((error: any, index: number) => (
                              <li key={index}>
                                {error.item}: {error.error.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Download Section */}
          {(state === 'completed' || state === 'partial_success') && conversionResponse && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                3. Download Converted Files
              </h2>
              <DownloadManager
                conversionId={conversionResponse.conversion_id}
                downloadUrls={conversionResponse.download_urls}
                filesConverted={conversionResponse.files_converted}
                totalEntries={conversionResponse.total_entries}
              />
            </section>
          )}

          {/* Reset for new conversion */}
          {(state === 'completed' || state === 'partial_success') && (
            <section className="text-center">
              <button
                onClick={() => {
                  resetState();
                  setSelectedFiles([]);
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Convert More Files
              </button>
            </section>
          )}

          {/* Rate Limit Information */}
          {retryAfter > 0 && (
            <section>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Rate Limit Information
                    </h3>
                    <p className="mt-1 text-sm text-blue-700">
                      You can try again in {Math.ceil(retryAfter / 60)} minute{Math.ceil(retryAfter / 60) > 1 ? 's' : ''}.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}