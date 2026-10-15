import { Component, type ErrorInfo, type ReactNode } from 'react';

import Icon from './Icon';

interface Props {
  children: ReactNode;
  /** Shown instead of the default full-page message, e.g. for a single widget. */
  fallback?: ReactNode;
  /** When this changes (a new page), the boundary tries rendering its children again. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  resetKey?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { hasError: false, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="wrap page-state">
        <div className="card state-card center">
          <span className="state-ic warn">
            <Icon name="alert" size={22} />
          </span>
          <h1>Something went wrong</h1>
          <p>This page hit an error. Reloading usually fixes it.</p>
          <div className="acts">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={16} />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
