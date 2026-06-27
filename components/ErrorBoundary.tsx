import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        // @ts-ignore
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-50 p-4">
                    <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl border border-red-200 overflow-hidden">
                        <div className="bg-red-600 px-6 py-4">
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <span>⚠️</span> Application Crashing Error
                            </h1>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-red-50 border border-red-100 rounded p-4">
                                <h2 className="text-red-800 font-semibold mb-2">Error Message:</h2>
                                <pre className="text-red-600 font-mono text-sm whitespace-pre-wrap break-words">
                                    {this.state.error?.toString()}
                                </pre>
                            </div>

                            {this.state.errorInfo && (
                                <div className="bg-slate-50 border border-slate-200 rounded p-4">
                                    <h2 className="text-slate-700 font-semibold mb-2">Component Stack:</h2>
                                    <pre className="text-slate-600 font-mono text-xs overflow-auto max-h-64 whitespace-pre">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-slate-500 text-sm">
                                    Please share this screenshot with the developer to fix the issue.
                                </p>
                                <button
                                    className="mt-4 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition"
                                    onClick={() => window.location.reload()}
                                >
                                    Reload Application
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // @ts-ignore
        return this.props.children;
    }
}
