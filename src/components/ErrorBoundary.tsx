import React from "react";

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
        console.error("Error caught by boundary:", error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="card card-accent mx-auto mt-8 max-w-2xl">
                    <div className="alert alert-error">
                        <div className="alert-icon">⚠️</div>
                        <div className="alert-content">
                            <div className="alert-title">Something went wrong</div>
                            <div className="alert-message">{this.state.error?.message}</div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
