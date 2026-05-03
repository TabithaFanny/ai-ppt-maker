'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, Copy, Home, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';
import Link from 'next/link';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
  copied: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const componentStack = errorInfo.componentStack || '';
    this.setState({ errorInfo: componentStack });
    logger.error('ErrorBoundary caught:', {
      message: error.message,
      stack: error.stack,
      componentStack: componentStack.slice(0, 500),
    });
  }

  handleCopy = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.message || 'Unknown'}`,
      error?.stack ? `Stack: ${error.stack}` : '',
      errorInfo ? `Component: ${errorInfo}` : '',
    ].filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="text-center max-w-lg px-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">页面出错了</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              应用遇到了一个意外错误。您可以尝试刷新页面，或返回首页。
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 rounded-lg text-left">
                <p className="text-sm font-medium text-gray-700 mb-1">错误详情</p>
                <p className="text-xs text-gray-500 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <RefreshCw size={16} />
                刷新页面
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <Home size={16} />
                返回首页
              </Link>
              <button
                onClick={this.handleCopy}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <Copy size={16} />
                {this.state.copied ? '已复制' : '复制错误'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
