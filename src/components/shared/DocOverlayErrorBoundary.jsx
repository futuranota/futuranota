import { Component } from "react";

/**
 * Catches render errors inside the open-folder overlay and notifies the parent
 * so the dark backdrop is not left behind with no content.
 */
export class DocOverlayErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[doc-overlay] render error", error, errorInfo);
    this.props.onError?.();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
