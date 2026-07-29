import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 自定义降级 UI，默认显示通用错误兜底 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 全局错误边界：避免任意子树渲染异常导致整页白屏。
 * PWA 场景下，用户可一键"重置"恢复到路由首屏，无需手动清缓存。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 控制台结构化日志，便于排障（暂未接入远端上报）
    console.error('[ErrorBoundary]', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-ink-950 text-ink-100">
          <div className="card max-w-md w-full p-6 space-y-4 text-center">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-lg font-semibold">页面出错了</h1>
            <p className="text-xs text-ink-400 break-all">
              {this.state.error.message || '渲染过程中发生未知错误'}
            </p>
            <div className="flex gap-2 justify-center">
              <button className="btn-primary text-xs" onClick={this.reset}>
                重试当前页
              </button>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  this.reset();
                  window.location.assign('/');
                }}
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
