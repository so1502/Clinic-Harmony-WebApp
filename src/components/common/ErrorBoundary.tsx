import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 rounded-xl border border-red-200 bg-red-50 text-center shadow-sm">
          <div className="rounded-full bg-red-100 p-3 mb-4 text-red-600">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-1">
            {this.props.fallbackTitle || "Ein Fehler ist aufgetreten"}
          </h3>
          <p className="text-sm text-red-700 max-w-md mb-4">
            {this.state.error?.message || "Die Komponente konnte nicht geladen werden."}
          </p>
          <Button
            onClick={this.handleRetry}
            variant="outline"
            className="border-red-300 text-red-800 hover:bg-red-100 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
