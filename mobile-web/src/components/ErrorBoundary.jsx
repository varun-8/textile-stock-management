import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught Error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div style={{
                    padding: '20px',
                    color: 'white',
                    backgroundColor: '#ef4444',
                    height: '100vh',
                    overflow: 'auto',
                    fontFamily: 'monospace'
                }}>
                    <h1>Something went wrong.</h1>
                    <p>Please screenshot this and send to support.</p>
                    <div style={{ background: '#000', padding: '10px', borderRadius: '5px', margin: '10px 0', whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                    </div>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: 'white',
                            color: 'black',
                            border: 'none',
                            borderRadius: '5px',
                            fontWeight: 'bold'
                        }}
                    >
                        Clear Cache & Reload
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
