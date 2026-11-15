import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Shows a friendly message instead of a blank page if a page crashes. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面出错：', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page-message">
        <p>页面出现错误，请刷新重试。</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          刷新页面
        </button>
      </div>
    );
  }
}
