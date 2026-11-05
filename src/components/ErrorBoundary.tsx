import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: a failed chunk load or render error shows a way out instead of a black page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>Da ist etwas schiefgelaufen</h1>
        <p>Diese Seite konnte nicht geladen werden. Lade sie neu und versuche es noch einmal.</p>
        <div>
          <button type="button" className="btn btn--white" onClick={() => window.location.reload()}>
            Neu laden
          </button>
          <button type="button" className="btn btn--gray" onClick={() => window.location.assign('/browse')}>
            Zur Startseite
          </button>
        </div>
      </div>
    );
  }
}
