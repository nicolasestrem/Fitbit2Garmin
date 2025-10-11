/**
 * @file File upload component with drag-and-drop support.
 * This component provides a user interface for selecting local files,
 * including a drag-and-drop area and a file list. It also integrates
 * with a payment/pass system to control usage limits.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { PassStatus } from './PassStatus';
import { UpgradeModal } from './UpgradeModal';

/**
 * @interface FileUploadProps
 * @description Props for the FileUpload component.
 * @property {(files: File[]) => void} onFilesSelected - Callback function invoked when files are selected or removed.
 * @property {number} [maxFiles=3] - The maximum number of files allowed.
 * @property {boolean} [disabled=false] - If true, the file upload functionality is disabled.
 */
interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

/**
 * A React component that provides a UI for file uploading, including drag-and-drop.
 * It manages the list of selected files, enforces file limits, and integrates with
 * a pass system for feature access.
 * @param {FileUploadProps} props - The component props.
 * @returns {React.ReactElement} The rendered file upload component.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxFiles = 3,
  disabled = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  /**
   * Effect hook to handle redirects from a Stripe payment flow.
   * It checks for `payment_success` or `payment_canceled` query parameters
   * and displays a message accordingly.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('payment_success');
    const canceled = params.get('payment_canceled');

    if (success === 'true') {
      // Show success message
      alert('Payment successful! Your unlimited pass is now active.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled === 'true') {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  /**
   * Callback for the `react-dropzone` hook.
   * It is called when files are dropped or selected. It validates the file count
   * and updates the state.
   * @param {File[]} acceptedFiles - The files accepted by the dropzone.
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length + selectedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFiles = [...selectedFiles, ...acceptedFiles];
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  }, [selectedFiles, maxFiles, onFilesSelected]);

  /**
   * Removes a specific file from the list of selected files.
   * @param {File} fileToRemove - The file to be removed.
   */
  const removeFile = (fileToRemove: File) => {
    const newFiles = selectedFiles.filter(file => file !== fileToRemove);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: maxFiles - selectedFiles.length,
    disabled,
  });

  const canAddMore = selectedFiles.length < maxFiles && !disabled;

  return (
    <div className="w-full">
      {/* Pass Status Display */}
      <div className="mb-6">
        <PassStatus onUpgradeClick={() => setShowUpgradeModal(true)} />
      </div>

      {/* Upload Area */}
      {canAddMore && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop files here' : 'Upload Google Takeout weight files'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Drag and drop or{' '}
              <span className="text-blue-600 font-medium">browse</span>{' '}
              to select JSON files
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Maximum {maxFiles} files • {selectedFiles.length}/{maxFiles} selected
            </p>
          </div>
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            Selected Files ({selectedFiles.length}/{maxFiles})
          </h3>
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
            >
              <div className="flex items-center space-x-3">
                <DocumentIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(file)}
                className="text-gray-400 hover:text-red-500 transition-colors"
                disabled={disabled}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          How to get your weight data:
        </h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to Fitbit app → Profile → Data Export</li>
          <li>Use Google Takeout to download your data</li>
          <li>Extract the ZIP file</li>
          <li>Navigate to <code className="bg-blue-100 px-1 rounded">Global Export Data</code></li>
          <li>Upload the <code className="bg-blue-100 px-1 rounded">weight-YYYY-MM-DD.json</code> files</li>
        </ol>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
};