import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryImpl extends React.Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  public render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <AlertTriangle className="text-red-500 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">页面出现错误</h3>
          <p className="text-red-600 dark:text-red-300 text-sm mb-4">{error?.message || '未知错误'}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
            <RefreshCw size={16} className="mr-2" />重试
          </button>
        </div>
      );
    }
    return children;
  }
}

export { ErrorBoundaryImpl as ErrorBoundary };
