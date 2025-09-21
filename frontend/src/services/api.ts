/**
 * API service for communicating with the backend
 */

import axios from 'axios';
import { FingerprintData } from './fingerprint';

// Configure API base URL (update for production)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';


const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout for file processing
});

export interface UploadResponse {
  upload_id: string;
  files_received: number;
  message: string;
}

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

export interface UsageLimits {
  conversions_used: number;
  conversions_limit: number;
  time_until_reset: number;
  can_convert: boolean;
}

export interface FileValidationResult {
  filename: string;
  is_valid: boolean;
  entry_count?: number;
  date_range?: string;
  size_kb?: number;
  error_message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  suggestion?: string;
  details?: string;
  error_code?: string;
}

class ApiService {
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
      throw error;
    }
  }



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

  // async getUsageLimits(fingerprintHash: string): Promise<UsageLimits> {
  //   try {
  //     const response = await api.get(`/usage/${fingerprintHash}`);
  //     return response.data;
  //   } catch (error) {
  //     this.handleApiError(error);
  //     throw error;
  //   }
  // }

  getDownloadUrl(conversionId: string, filename: string): string {
    return `${API_BASE_URL}/download/${conversionId}/${filename}`;
  }

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

  private handleApiError(error: any): void {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;

      if (error.response?.status === 429) {
        // Rate limit exceeded - include retry information
        const retryAfter = error.response.headers['retry-after'];
        const resetTime = error.response.headers['x-ratelimit-reset'];

        let message = apiError?.error || 'Rate limit exceeded. Please try again later.';
        if (retryAfter) {
          const waitTime = parseInt(retryAfter);
          const waitMinutes = Math.ceil(waitTime / 60);
          message += ` Please wait ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''} before trying again.`;
        }

        throw new Error(message);
      } else if (error.response?.status === 400) {
        // Bad request - provide specific guidance
        const suggestion = apiError?.suggestion || 'Please check your files and try again.';
        throw new Error(apiError?.error || apiError?.message || `Invalid request. ${suggestion}`);
      } else if (error.response?.status === 422) {
        // Validation error - provide specific guidance
        const suggestion = apiError?.suggestion || 'Please check your input format.';
        throw new Error(apiError?.error || apiError?.message || `Validation error. ${suggestion}`);
      } else if (error.response?.status === 413) {
        // File too large
        throw new Error(apiError?.error || 'File too large. Please use smaller files.');
      } else if (error.response?.status === 207) {
        // Partial success - don't treat as error, let caller handle
        return;
      } else if (error.response?.status && error.response.status >= 500) {
        // Server error - surface details from API if present
        const suggestion = apiError?.suggestion || 'Please try again later.';
        throw new Error(apiError?.error || apiError?.message || `Server error. ${suggestion}`);
      } else {
        // Other HTTP errors
        const suggestion = apiError?.suggestion || '';
        throw new Error(apiError?.error || apiError?.message || error.message || 'An unexpected error occurred.' + (suggestion ? ` ${suggestion}` : ''));
      }
    } else {
      // Network or other errors
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  // Helper method to trigger file download in browser
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

  // Format time until reset for display
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
