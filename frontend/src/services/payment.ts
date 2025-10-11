/**
 * @file Payment Service - Handles Stripe checkout and pass status.
 * This service provides functions to interact with the payment-related backend endpoints,
 * such as creating Stripe checkout sessions, fetching pass status, and getting pricing info.
 */

const API_BASE = '/api';

/**
 * @interface PassStatus
 * @description Represents the current status of a user's premium pass.
 */
export interface PassStatus {
  hasPass: boolean;
  passType: '24h' | '7d' | null;
  expiresAt: string | null;
  hoursRemaining: number;
  purchasedAt?: string;
}

/**
 * @interface CheckoutSession
 * @description Represents the data returned after creating a Stripe checkout session.
 */
export interface CheckoutSession {
  sessionId: string;
  url: string;
}

/**
 * @interface Pricing
 * @description Defines the structure for the pricing information of available passes.
 */
export interface Pricing {
  '24h': {
    cents: number;
    currency: string;
    name: string;
    duration: number;
    priceFormatted: string;
  };
  '7d': {
    cents: number;
    currency: string;
    name: string;
    duration: number;
    priceFormatted: string;
  };
}

/**
 * @interface ApiErrorResponse
 * @description A generic structure for API error responses.
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
}

/**
 * Creates a Stripe checkout session for a given pass type.
 * @param {'24h' | '7d'} passType - The type of pass to purchase ('24h' or '7d').
 * @returns {Promise<CheckoutSession>} A promise that resolves to the checkout session details.
 * @throws {Error} If the request to create a session fails.
 */
export async function createCheckoutSession(passType: '24h' | '7d'): Promise<CheckoutSession> {
  try {
    const response = await fetch(`${API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ passType })
    });

    if (!response.ok) {
      const error = await response.json() as ApiErrorResponse;
      throw new Error(error.message || 'Failed to create checkout session');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Checkout session error:', error);
    throw error;
  }
}

/**
 * Fetches the current pass status for the user from the backend.
 * @returns {Promise<PassStatus>} A promise that resolves to the user's pass status.
 * In case of an error, it returns a default "no pass" status.
 */
export async function getPassStatus(): Promise<PassStatus> {
  try {
    const response = await fetch(`${API_BASE}/pass-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json() as ApiErrorResponse;
      throw new Error(error.message || 'Failed to get pass status');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Pass status error:', error);
    // Return default status on error
    return {
      hasPass: false,
      passType: null,
      expiresAt: null,
      hoursRemaining: 0
    };
  }
}

/**
 * Fetches the pricing information for all available passes.
 * @returns {Promise<Pricing>} A promise that resolves to the pricing details.
 * In case of an error, it returns default fallback pricing.
 */
export async function getPricing(): Promise<Pricing> {
  try {
    const response = await fetch(`${API_BASE}/pricing`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get pricing');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Pricing error:', error);
    // Return default pricing
    return {
      '24h': {
        cents: 249,
        currency: 'eur',
        name: '24-hour pass',
        duration: 24,
        priceFormatted: '€2.49'
      },
      '7d': {
        cents: 599,
        currency: 'eur',
        name: '7-day pass',
        duration: 168,
        priceFormatted: '€5.99'
      }
    };
  }
}

/**
 * Creates a checkout session and redirects the user to the Stripe checkout page.
 * @param {'24h' | '7d'} passType - The type of pass to purchase.
 * @throws {Error} If the redirect fails or no checkout URL is returned.
 */
export async function redirectToCheckout(passType: '24h' | '7d'): Promise<void> {
  try {
    const session = await createCheckoutSession(passType);

    if (session.url) {
      window.location.href = session.url;
    } else {
      throw new Error('No checkout URL returned');
    }
  } catch (error) {
    console.error('Redirect to checkout failed:', error);
    throw error;
  }
}
