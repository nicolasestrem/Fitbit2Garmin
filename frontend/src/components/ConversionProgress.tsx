/**
 * Conversion progress and status component
 */

import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface ConversionProgressProps {
  status: 'idle' | 'loading' | 'uploading' | 'validating' | 'converting' | 'completed' | 'error' | 'partial_success';
  message?: string;
  progress?: number;
  error?: string;
}

export const ConversionProgress: React.FC<ConversionProgressProps> = ({
  status,
  message,
  progress = 0,
  error,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
      case 'partial_success':
        return <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />;
      case 'loading':
      case 'uploading':
      case 'validating':
      case 'converting':
        return <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'partial_success':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'loading':
      case 'uploading':
      case 'validating':
      case 'converting':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusMessage = () => {
    if (message) return message;

    switch (status) {
      case 'loading':
        return 'Connecting to server...';
      case 'uploading':
        return 'Uploading files...';
      case 'validating':
        return 'Validating file format...';
      case 'converting':
        return 'Converting to Garmin format...';
      case 'completed':
        return 'Conversion completed successfully!';
      case 'partial_success':
        return 'Conversion partially completed';
      case 'error':
        return error || 'An error occurred during conversion';
      default:
        return '';
    }
  };

  if (status === 'idle') {
    return null;
  }

  return (
    <div className={`border rounded-lg p-6 ${getStatusColor()}`}>
      <div className="flex items-center space-x-4">
        {getStatusIcon()}
        <div className="flex-1">
          <h3 className="text-lg font-medium">{getStatusMessage()}</h3>

          {/* Progress bar for active operations */}
          {(status === 'loading' || status === 'uploading' || status === 'validating' || status === 'converting') && (
            <div className="mt-3">
              <div className="bg-white bg-opacity-50 rounded-full h-2">
                <div
                  className="bg-current h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm mt-1 opacity-75">{progress}% complete</p>
            </div>
          )}

          {/* Error details */}
          {status === 'error' && error && (
            <div className="mt-2">
              <p className="text-sm opacity-75">{error}</p>
            </div>
          )}

          {/* Success details */}
          {status === 'completed' && (
            <div className="mt-2">
              <p className="text-sm opacity-75">
                Your files are ready for download. Import them to Garmin Connect to restore your weight history.
              </p>
            </div>
          )}

          {/* Partial success details */}
          {status === 'partial_success' && (
            <div className="mt-2">
              <p className="text-sm opacity-75">
                Some files were converted successfully. Check the details above and download the available files.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};