import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('TJW Application ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let displayDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error) {
          displayDetail = `${parsed.error} (${parsed.operationType ?? 'operation'} on ${parsed.path ?? 'database'})`;
        }
      } catch {
        // Plain error message
      }

      return (
        <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E5E7EB] p-8">
            <div className="text-xs font-semibold tracking-wider text-[#790D16] mb-2">
              TJW GROUP TAX DEPARTMENT
            </div>
            <h1 className="text-xl font-bold text-[#1C1917] mb-3">
              Workspace Encountered an Error
            </h1>
            <p className="text-sm text-[#57534E] leading-relaxed mb-6 break-words">
              {displayDetail}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-[#790D16] text-white hover:bg-[#5E0A11] transition-colors cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
