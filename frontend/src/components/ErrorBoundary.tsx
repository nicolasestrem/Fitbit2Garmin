/**
 * @file Error boundary component to catch React errors.
 * This component wraps parts of the application and catches JavaScript errors
 * anywhere in their child component tree, logging those errors, and displaying a fallback UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * @interface Props
 * @description Props for the ErrorBoundary component.
 * @property {ReactNode} children - The child components that the boundary will wrap.
 * @property {ReactNode} [fallback] - An optional custom component to render on error.
 */
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * @interface State
 * @description State for the ErrorBoundary component.
 * @property {boolean} hasError - True if an error has been caught.
 * @property {Error} [error] - The error that was caught.
 * @property {ErrorInfo} [errorInfo] - An object with a `componentStack` key containing information about which component threw the error.
 */
interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * A React class component that acts as an error boundary.
 * It catches errors in its child component tree, logs them, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  /**
   * The state of the component, initialized to not have an error.
   * @type {State}
   */
  public state: State = {
    hasError: false
  };

  /**
   * A lifecycle method that is invoked after an error has been thrown by a descendant component.
   * It receives the error that was thrown as a parameter and should return a value to update state.
   * @param {Error} error - The error that was thrown.
   * @returns {State} A state update to signify an error has occurred.
   */
  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  /**
   * A lifecycle method that is invoked after an error has been thrown by a descendant component.
   * It receives two parameters: the error, and an object with a componentStack key.
   * @param {Error} error - The error that was thrown.
   * @param {ErrorInfo} errorInfo - An object with a `componentStack` key.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  /**
   * Renders the component. If an error has been caught, it renders a fallback UI.
   * Otherwise, it renders the child components.
   * @returns {ReactNode} The rendered component tree.
   */
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