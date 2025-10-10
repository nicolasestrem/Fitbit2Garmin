/**
 * @file Download manager component for converted FIT files.
 * This component displays a list of downloadable files from a conversion,
 * manages their download state, and provides functionality to download single or all files.
 */

import React, { useState } from 'react';
import { ArrowDownTrayIcon, CheckIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

/**
 * @interface DownloadManagerProps
 * @description Props for the DownloadManager component.
 * @property {string} conversionId - The unique identifier for the conversion process.
 * @property {string[]} downloadUrls - A list of URLs for the converted files.
 * @property {number} filesConverted - The number of files that were successfully converted.
 * @property {number} totalEntries - The total number of data entries processed.
 */
interface DownloadManagerProps {
  conversionId: string;
  downloadUrls: string[];
  filesConverted: number;
  totalEntries: number;
}

/**
 * A React component that manages the downloading of converted FIT files.
 * It displays a list of files, tracks download status for each, and allows
 * for downloading all files at once.
 * @param {DownloadManagerProps} props - The component props.
 * @returns {React.ReactElement} The rendered download manager.
 */
export const DownloadManager: React.FC<DownloadManagerProps> = ({
  conversionId,
  downloadUrls,
  filesConverted,
  totalEntries,
}) => {
  const [downloadStatus, setDownloadStatus] = useState<Record<string, 'pending' | 'downloading' | 'completed'>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  /**
   * Downloads a single file from the given URL.
   * It updates the download status of the file and handles potential errors.
   * @param {string} url - The URL of the file to download.
   */
  const downloadFile = async (url: string) => {
    const filename = url.split('/').pop() || 'converted-file.fit';

    try {
      setDownloadStatus(prev => ({ ...prev, [filename]: 'downloading' }));

      const blob = await apiService.downloadFile(conversionId, filename);
      apiService.downloadBlob(blob, filename);

      setDownloadStatus(prev => ({ ...prev, [filename]: 'completed' }));
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStatus(prev => ({ ...prev, [filename]: 'pending' }));
      alert(`Failed to download ${filename}. Please try again.`);
    }
  };

  /**
   * Downloads all available files sequentially.
   * It sets a global downloading state and adds a small delay between each download.
   */
  const downloadAll = async () => {
    setIsDownloadingAll(true);
    for (const url of downloadUrls) {
      const filename = url.split('/').pop() || 'converted-file.fit';
      if (downloadStatus[filename] !== 'completed') {
        await downloadFile(url);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    setIsDownloadingAll(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Converted Files Ready</h3>
          <p className="text-sm text-gray-500">
            {filesConverted} files converted • {totalEntries} weight entries
          </p>
        </div>
        <button
          onClick={downloadAll}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <ArrowDownTrayIcon className={`h-4 w-4 mr-2 ${isDownloadingAll ? 'animate-spin' : ''}`} />
          {isDownloadingAll ? 'Downloading...' : 'Download All'}
        </button>
      </div>

      <div className="space-y-2">
        {downloadUrls.map((url, index) => {
          const filename = url.split('/').pop() || `file-${index + 1}.fit`;
          const status = downloadStatus[filename] || 'pending';

          return (
            <div
              key={url}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
            >
              <div className="flex items-center space-x-3">
                <div className={`
                  w-2 h-2 rounded-full
                  ${status === 'completed' ? 'bg-green-500' :
                    status === 'downloading' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}
                `} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{filename}</p>
                  <p className="text-xs text-gray-500">
                    {status === 'completed' ? 'Downloaded' :
                     status === 'downloading' ? 'Downloading...' : 'Ready to download'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => downloadFile(url)}
                disabled={status === 'downloading'}
                className={`
                  inline-flex items-center px-3 py-1 text-sm rounded-md transition-colors
                  ${status === 'completed'
                    ? 'bg-green-100 text-green-700 cursor-default'
                    : status === 'downloading'
                    ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {status === 'completed' ? (
                  <>
                    <CheckIcon className="h-3 w-3 mr-1" />
                    Downloaded
                  </>
                ) : status === 'downloading' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    'Downloading...'
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
                    Download
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-green-900 mb-2">
          Next Steps:
        </h4>
        <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
          <li>Download all .fit files</li>
          <li>Go to Garmin Connect (web or mobile)</li>
          <li>Navigate to Import Data</li>
          <li>Upload each .fit file</li>
          <li>Your weight history will appear in your timeline!</li>
        </ol>
      </div>

      {/* Success tip */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <span className="font-medium">💡 Tip:</span> Import files one by one to avoid overwhelming Garmin Connect.
          Historical data (older years) should import without conflicts.
        </p>
      </div>
    </div>
  );
};