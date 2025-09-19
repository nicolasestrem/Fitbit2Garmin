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
  error_message?: string;
}

export interface ApiError {
  error: string;
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
      const response = await api.get(`/download/${conversionId}/${filename}`, {
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
        // Rate limit exceeded
        throw new Error(apiError?.error || 'Rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 400) {
        // Bad request
        throw new Error(apiError?.error || 'Invalid request. Please check your files.');
      } else if (error.response?.status === 422) {
        // Validation error
        throw new Error(apiError?.error || 'Validation error. Please check your input.');
      } else if (error.response?.status && error.response.status >= 500) {
        // Server error
        throw new Error('Server error. Please try again later.');
      } else {
        // Other HTTP errors
        throw new Error(apiError?.error || error.message || 'An unexpected error occurred.');
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