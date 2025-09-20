/**
 * Error boundary component to catch React errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h1 className="text-xl font-semibold text-red-900 mb-4">
                Something went wrong
              </h1>
              <p className="text-red-700 mb-4">
                The application encountered an error. Please try refreshing the page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Refresh Page
              </button>

              {/* Development error details */}
              {import.meta.env.DEV && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-red-800">
                    Error Details (Development)
                  </summary>
                  <div className="mt-2 p-4 bg-red-100 rounded border text-xs font-mono">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error?.toString()}
                    </div>
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap">
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                    <div className="mt-2">
                      <strong>Error Stack:</strong>
                      <pre className="whitespace-pre-wrap">
                        {this.state.error?.stack}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}