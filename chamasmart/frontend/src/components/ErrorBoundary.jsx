import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-container" style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    margin: '2rem'
                }}>
                    <h2 style={{ color: '#b91c1c' }}>Something went wrong</h2>
                    <p style={{ color: '#7f1d1d', marginBottom: '1.5rem' }}>
                        The application encountered an unexpected error.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <pre style={{
                            marginTop: '1.5rem',
                            padding: '1rem',
                            background: '#fff',
                            textAlign: 'left',
                            overflow: 'auto',
                            fontSize: '0.8rem'
                        }}>
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
