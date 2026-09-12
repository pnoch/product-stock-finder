import { Component, type ReactNode } from "react";

// The boundary wraps <App /> in main.tsx — OUTSIDE the HashRouter that App
// contains — so it can catch router crashes too. Retry is a state reset only;
// there is no navigate here (no router context above App).
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("[boundary] render crash", error);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-screen p-6 text-center"
        >
          <p className="text-lg font-bold">We couldn&apos;t load this screen</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Something unexpected happened. Your data is safe — try again.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-5 px-6 py-3 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
