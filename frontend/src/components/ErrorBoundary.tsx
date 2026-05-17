import { Component, type ReactNode } from "react";
import { AlertOctagon } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Top-level boundary so a render crash shows a recoverable screen, not a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Unhandled UI error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-screen place-items-center bg-bg p-6">
          <div className="panel max-w-md p-6 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-fail/40 bg-fail/10 text-fail">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold">Something went off the rails</h1>
            <p className="mt-1.5 text-sm text-muted">
              The interface hit an unexpected error. Reloading usually clears it.
            </p>
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-line bg-bg2 p-2.5 text-left font-mono text-2xs text-dim">
              {this.state.error.message}
            </pre>
            <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
