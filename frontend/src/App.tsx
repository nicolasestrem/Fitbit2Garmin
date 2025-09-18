/**
 * Main application component
 */

import React, { useState, useEffect } from 'react';
import { Analytics } from "@vercel/analytics/react";
import { FileUpload } from './components/FileUpload';
import { ConversionProgress } from './components/ConversionProgress';
import { DownloadManager } from './components/DownloadManager';
import { apiService, UploadResponse, ConversionResponse, UsageLimits } from './services/api';
import { fingerprintService, FingerprintData } from './services/fingerprint';

type AppState = 'idle' | 'uploading' | 'validating' | 'converting' | 'completed' | 'error';

function App() {
  const [state, setState] = useState<AppState>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [conversionResponse, setConversionResponse] = useState<ConversionResponse | null>(null);
  const [fingerprint, setFingerprint] = useState<FingerprintData | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  // Initialize fingerprint on app load
  useEffect(() => {
    const initializeFingerprint = async () => {
      try {
        const fp = await fingerprintService.getCachedFingerprint();
        setFingerprint(fp);

        // Get usage limits
        const limits = await apiService.getUsageLimits(fp.fingerprint_hash);
        setUsageLimits(limits);
      } catch (error) {
        console.error('Failed to initialize fingerprint:', error);
      }
    };

    initializeFingerprint();
  }, []);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setError('');
  };

  const resetState = () => {
    setState('idle');
    setUploadResponse(null);
    setConversionResponse(null);
    setError('');
    setProgress(0);
  };

  const handleConvert = async () => {
    if (!fingerprint) {
      setError('Fingerprint not ready. Please try again.');
      return;
    }

    if (!usageLimits?.can_convert) {
      setError(`Daily limit exceeded. Used ${usageLimits?.conversions_used}/${usageLimits?.conversions_limit} conversions.`);
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Please select files to convert.');
      return;
    }

    try {
      // Step 1: Upload files
      setState('uploading');
      setProgress(20);
      const uploadResult = await apiService.uploadFiles(selectedFiles);
      setUploadResponse(uploadResult);

      // Step 2: Validate files
      setState('validating');
      setProgress(40);
      await apiService.validateFiles(uploadResult.upload_id);

      // Step 3: Convert files
      setState('converting');
      setProgress(60);
      const conversionResult = await apiService.convertFiles(uploadResult.upload_id, fingerprint);
      setConversionResponse(conversionResult);

      // Step 4: Complete
      setProgress(100);
      setState('completed');

      // Update usage limits
      const updatedLimits = await apiService.getUsageLimits(fingerprint.fingerprint_hash);
      setUsageLimits(updatedLimits);

    } catch (error) {
      console.error('Conversion failed:', error);
      setError(error instanceof Error ? error.message : 'Conversion failed');
      setState('error');
    }
  };

  const canConvert = selectedFiles.length > 0 && usageLimits?.can_convert && state === 'idle';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Fitbit to Garmin Converter
              </h1>
              <p className="text-gray-600 mt-1">
                Convert your Fitbit weight data to Garmin-compatible .fit files
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {usageLimits ? (
                  <>
                    <span className="font-medium">
                      {usageLimits.conversions_used}/{usageLimits.conversions_limit}
                    </span>
                    {' conversions used today'}
                    {usageLimits.time_until_reset > 0 && (
                      <span className="block text-xs text-gray-400">
                        Resets in {apiService.formatTimeUntilReset(usageLimits.time_until_reset)}
                      </span>
                    )}
                  </>
                ) : (
                  'Loading...'
                )}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* File Upload Section */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Upload Your Weight Data
            </h2>
            <FileUpload
              onFilesSelected={handleFilesSelected}
              maxFiles={2}
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

              {/* Rate limit warning */}
              {usageLimits && !usageLimits.can_convert && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Daily limit reached:</span>{' '}
                    You've used {usageLimits.conversions_used}/{usageLimits.conversions_limit} conversions today.{' '}
                    <span className="text-blue-600 font-medium cursor-pointer hover:underline">
                      Upgrade for unlimited conversions
                    </span>
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Progress Section */}
          <ConversionProgress
            status={state}
            progress={progress}
            error={error}
          />

          {/* Download Section */}
          {state === 'completed' && conversionResponse && (
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
          {state === 'completed' && (
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
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>
              Built by the community, for the community 🏃‍♂️💨
            </p>
            <div className="space-x-4">
              <a href="#" className="hover:text-gray-700">Documentation</a>
              <a href="#" className="hover:text-gray-700">Support</a>
              <a href="#" className="hover:text-gray-700">Upgrade</a>
            </div>
          </div>
        </div>
      </footer>
      <Analytics />
    </div>
  );
}

export default App;