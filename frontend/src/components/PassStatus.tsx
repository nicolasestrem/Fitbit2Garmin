/**
 * Pass Status - Displays active pass information
 * Shows expiration time and pass type for premium users
 */

import React, { useState, useEffect } from 'react';
import { getPassStatus, type PassStatus as PassStatusType } from '../services/payment';

interface PassStatusProps {
  onUpgradeClick?: () => void;
}

export function PassStatus({ onUpgradeClick }: PassStatusProps) {
  const [passStatus, setPassStatus] = useState<PassStatusType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPassStatus();
    // Refresh status every 5 minutes
    const interval = setInterval(loadPassStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadPassStatus = async () => {
    try {
      const status = await getPassStatus();
      setPassStatus(status);
    } catch (error) {
      console.error('Failed to load pass status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-sm text-gray-600">Loading status...</span>
        </div>
      </div>
    );
  }

  if (!passStatus) {
    return null;
  }

  // Free tier user
  if (!passStatus.hasPass) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-gray-900">Free Tier</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              3 files per day • Resets at midnight UTC
            </p>
          </div>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>
    );
  }

  // Premium user with active pass
  const expiresAt = passStatus.expiresAt ? new Date(passStatus.expiresAt) : null;
  const passTypeName = passStatus.passType === '24h' ? '24-Hour' : '7-Day';

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900">{passTypeName} Pass Active</h3>
            <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-full">
              UNLIMITED
            </span>
          </div>

          <div className="space-y-1 text-sm">
            {passStatus.hoursRemaining > 0 && (
              <p className="text-gray-700">
                <span className="font-semibold">{passStatus.hoursRemaining} hours</span> remaining
              </p>
            )}
            {expiresAt && (
              <p className="text-gray-600">
                Expires {expiresAt.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
            <p className="text-green-700 font-medium">
              Convert as many files as you need!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
