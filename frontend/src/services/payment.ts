/**
 * Payment Service - Handles Stripe checkout and pass status
 */

const API_BASE = '/api';

export interface PassStatus {
  hasPass: boolean;
  passType: '24h' | '7d' | null;
  expiresAt: string | null;
  hoursRemaining: number;
  purchasedAt?: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

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

export interface ApiErrorResponse {
  error: string;
  message: string;
}

/**
 * Create a Stripe checkout session
 * @param passType - '24h' or '7d'
 * @returns Checkout session details
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
 * Get current pass status for user
 * @returns Pass status details
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
 * Get pricing information
 * @returns Pricing details for passes
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
 * Redirect to Stripe checkout
 * @param passType - '24h' or '7d'
 */
export async function redirectToCheckout(passType: '24h' | '7d'): Promise<void> {
  try {
    const session = await createCheckoutSession(passType);

    // Redirect to Stripe checkout
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
