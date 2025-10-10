/**
 * @file API service for communicating with the backend.
 * This service encapsulates all HTTP requests to the server, handling
 * request creation, response parsing, and error management.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout for file processing
});

/**
 * @interface UploadResponse
 * @description The response structure from the file upload endpoint.
 */
export interface UploadResponse {
  upload_id: string;
  files_received: number;
  message: string;
}

/**
 * @interface ConversionResponse
 * @description The response structure from the file conversion endpoint.
 */
export interface ConversionResponse {
  conversion_id: string;
  files_converted: number;
  total_entries: number;
  download_urls: string[];
  message: string;
  partial_success?: boolean;
  successful_files?: number;
  failed_files?: number;
  errors?: Array<{
    item: string;
    status: string;
    error: {
      message: string;
      error_code?: string;
    };
  }>;
}

/**
 * @interface UsageLimits
 * @description Represents the usage limits for a user.
 */
export interface UsageLimits {
  conversions_used: number;
  conversions_limit: number;
  time_until_reset: number;
  can_convert: boolean;
}

/**
 * @interface FileValidationResult
 * @description The result of validating a single file.
 */
export interface FileValidationResult {
  filename: string;
  is_valid: boolean;
  entry_count?: number;
  date_range?: string;
  size_kb?: number;
  error_message?: string;
}

/**
 * @interface ApiError
 * @description A standardized error structure returned from the API.
 */
export interface ApiError {
  error: string;
  message?: string;
  suggestion?: string;
  details?: string;
  error_code?: string;
}

/**
 * Provides methods for interacting with the backend API.
 * Handles file uploads, validation, conversion, and downloads.
 */
class ApiService {
  /**
   * Uploads an array of files to the server.
   * @param {File[]} files - The files to upload.
   * @returns {Promise<UploadResponse>} The response from the upload endpoint.
   * @throws {Error} If the API call fails.
   */
  async uploadFiles(files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error);
      throw error; // Will be a custom error from handleApiError
    }
  }

  /**
   * Requests validation for a set of previously uploaded files.
   * @param {string} uploadId - The ID of the upload session.
   * @returns {Promise<FileValidationResult[]>} A list of validation results for each file.
   * @throws {Error} If the API call fails.
   */
  async validateFiles(uploadId: string): Promise<FileValidationResult[]> {
    try {
      const response = await api.post('/validate', {
        upload_id: uploadId,
      });

      return response.data.files || [];
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Requests conversion for a set of previously uploaded files.
   * @param {string} uploadId - The ID of the upload session.
   * @returns {Promise<ConversionResponse>} The result of the conversion.
   * @throws {Error} If the API call fails.
   */
  async convertFiles(uploadId: string): Promise<ConversionResponse> {
    try {
      const response = await api.post('/convert', {
        upload_id: uploadId,
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Constructs the full URL for downloading a converted file.
   * @param {string} conversionId - The ID of the conversion.
   * @param {string} filename - The name of the file to download.
   * @returns {string} The full download URL.
   */
  getDownloadUrl(conversionId: string, filename: string): string {
    return `${API_BASE_URL}/download/${conversionId}/${filename}`;
  }

  /**
   * Fetches a converted file as a Blob from the server.
   * @param {string} conversionId - The ID of the conversion.
   * @param {string} filename - The name of the file to download.
   * @returns {Promise<Blob>} A promise that resolves to the file Blob.
   * @throws {Error} If the API call fails.
   */
  async downloadFile(conversionId: string, filename: string): Promise<Blob> {
    try {
      const encodedName = encodeURIComponent(filename);
      const response = await api.get(`/download/${conversionId}/${encodedName}`, {
        responseType: 'blob',
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Handles API errors by parsing the error response and throwing a more specific,
   * user-friendly error.
   * @param {any} error - The error object, typically from Axios.
   * @throws {Error} A new, more descriptive error.
   * @private
   */
  private handleApiError(error: any): void {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;

      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        let message = apiError?.error || 'Rate limit exceeded. Please try again later.';
        if (retryAfter) {
          const waitTime = parseInt(retryAfter);
          const waitMinutes = Math.ceil(waitTime / 60);
          message += ` Please wait ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''} before trying again.`;
        }
        throw new Error(message);
      } else if (error.response?.status === 400) {
        const suggestion = apiError?.suggestion || 'Please check your files and try again.';
        throw new Error(apiError?.error || apiError?.message || `Invalid request. ${suggestion}`);
      } else if (error.response?.status === 422) {
        const suggestion = apiError?.suggestion || 'Please check your input format.';
        throw new Error(apiError?.error || apiError?.message || `Validation error. ${suggestion}`);
      } else if (error.response?.status === 413) {
        throw new Error(apiError?.error || 'File too large. Please use smaller files.');
      } else if (error.response?.status === 207) {
        return; // Partial success is handled by the caller, not as a thrown error.
      } else if (error.response?.status && error.response.status >= 500) {
        const suggestion = apiError?.suggestion || 'Please try again later.';
        throw new Error(apiError?.error || apiError?.message || `Server error. ${suggestion}`);
      } else {
        const suggestion = apiError?.suggestion || '';
        throw new Error(apiError?.error || apiError?.message || error.message || 'An unexpected error occurred.' + (suggestion ? ` ${suggestion}` : ''));
      }
    } else {
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  /**
   * Triggers a file download in the browser.
   * @param {Blob} blob - The file content as a Blob.
   * @param {string} filename - The desired name for the downloaded file.
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Formats a duration in seconds into a human-readable string (e.g., "2h 30m").
   * @param {number} seconds - The duration in seconds.
   * @returns {string} The formatted time string.
   */
  formatTimeUntilReset(seconds: number): string {
    if (seconds <= 0) return 'Available now';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

export const apiService = new ApiService();
