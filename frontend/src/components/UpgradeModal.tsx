/**
 * Upgrade Modal - Purchase unlimited passes
 * Displays pricing options and redirects to Stripe checkout
 */

import React, { useState, useEffect } from 'react';
import { redirectToCheckout, getPricing, type Pricing } from '../services/payment';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  filesUsed?: number;
  filesRemaining?: number;
  resetTime?: number;
}

export function UpgradeModal({
  isOpen,
  onClose,
  filesUsed = 0,
  filesRemaining = 0,
  resetTime
}: UpgradeModalProps) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPass, setSelectedPass] = useState<'24h' | '7d' | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPricing();
    }
  }, [isOpen]);

  const loadPricing = async () => {
    try {
      const pricingData = await getPricing();
      setPricing(pricingData);
    } catch (error) {
      console.error('Failed to load pricing:', error);
    }
  };

  const handleUpgrade = async (passType: '24h' | '7d') => {
    setIsLoading(true);
    setSelectedPass(passType);

    try {
      await redirectToCheckout(passType);
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Failed to start checkout. Please try again.');
      setIsLoading(false);
      setSelectedPass(null);
    }
  };

  if (!isOpen) return null;

  const resetDate = resetTime ? new Date(resetTime * 1000) : null;
  const hoursUntilReset = resetDate
    ? Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60))
    : 24;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Unlock Unlimited Conversions</h2>
              <p className="text-blue-100">
                You've used {filesUsed} of 3 free files today
              </p>
              {resetDate && (
                <p className="text-sm text-blue-200 mt-1">
                  Free tier resets in {hoursUntilReset} hours
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* 24-hour Pass */}
            <div className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-colors">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">24-Hour Pass</h3>
                <div className="text-3xl font-bold text-blue-600">
                  {pricing?.['24h'].priceFormatted || '€2.49'}
                </div>
                <p className="text-sm text-gray-600">One-time payment</p>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited conversions for 24 hours
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Convert as many files as you need
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Perfect for one-time bulk imports
                </li>
              </ul>

              <button
                onClick={() => handleUpgrade('24h')}
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  isLoading && selectedPass === '24h'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isLoading && selectedPass === '24h' ? 'Loading...' : 'Get 24-Hour Pass'}
              </button>
            </div>

            {/* 7-day Pass */}
            <div className="border-2 border-blue-500 rounded-lg p-6 relative bg-blue-50">
              <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg rounded-tr-lg">
                BEST VALUE
              </div>

              <div className="text-center mb-4 mt-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">7-Day Pass</h3>
                <div className="text-3xl font-bold text-blue-600">
                  {pricing?.['7d'].priceFormatted || '€5.99'}
                </div>
                <p className="text-sm text-gray-600">
                  €0.86/day
                </p>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited conversions for 7 days
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Convert multiple exports at your pace
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save 65% vs daily passes
                </li>
              </ul>

              <button
                onClick={() => handleUpgrade('7d')}
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  isLoading && selectedPass === '7d'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                }`}
              >
                {isLoading && selectedPass === '7d' ? 'Loading...' : 'Get 7-Day Pass'}
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-gray-900 mb-2">All passes include:</h4>
            <ul className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
              <li className="flex items-center">
                <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No file size limits
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Priority processing
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                100% secure payment
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Instant activation
              </li>
            </ul>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-600">
            <p>Secure payment powered by Stripe • No subscription required</p>
          </div>
        </div>
      </div>
    </div>
  );
}
