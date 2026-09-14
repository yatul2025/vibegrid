import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React Error Boundary Caught]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '30px 20px',
          textAlign: 'center',
          color: '#e2e8f0',
          background: 'var(--bg-primary, #0f172a)'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>
            Something went wrong rendering this page
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '440px', marginBottom: '24px', lineHeight: '1.5' }}>
            {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
              background: '#6366f1',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
