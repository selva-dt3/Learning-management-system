import React from 'react';

/**
 * ErrorBoundary to catch uncaught errors in React tree and show a friendly message.
 * Avoids white screens on unexpected runtime exceptions.
 */
// PUBLIC_INTERFACE
export default class ErrorBoundary extends React.Component {
  /** Wraps children and renders a fallback on error. */
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    // Update state to show fallback UI
    return { hasError: true, errorMessage: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error, info) {
    // Could add logging to a remote service here (but avoid sending sensitive data)
    // console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: 24 }}>
          <h2>Something went wrong</h2>
          <p style={{ color: 'tomato' }}>{this.state.errorMessage}</p>
          <button onClick={() => this.setState({ hasError: false, errorMessage: '' })}>
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
