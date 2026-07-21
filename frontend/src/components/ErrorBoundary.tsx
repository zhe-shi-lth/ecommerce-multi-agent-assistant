import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// 顶层错误边界：捕获渲染期未处理异常，避免整页白屏无提示。
// 出错时展示可读错误堆栈，便于定位（替代原先的空白页）。
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 仅打印到控制台，错误信息仍渲染到页面供用户/开发者阅读
    console.error("渲染错误：", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>页面渲染出错</h2>
          <p className="muted">下方为错误详情，可截图或复制给开发者排查：</p>
          <pre className="error-detail">{this.state.error.message}</pre>
          <pre className="error-detail">{this.state.error.stack}</pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
