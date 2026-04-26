import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="text-center space-y-3">
            <p className="text-slate-700 font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-400">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-green-700 hover:text-green-900 underline cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
