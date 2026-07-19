import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { isAuthed, setToken } from "../auth";
import RobotMascot from "../components/RobotMascot";

// 前端模拟账号（仅演示用，不接后端）。
const DEMO = { email: "admin@shop.local", password: "admin123" };

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 已登录则直接进后台
  if (isAuthed()) return <Navigate to="/" replace />;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("请输入账号和密码");
      return;
    }
    setBusy(true);
    // 模拟网络请求，留下柔和反馈空间
    setTimeout(() => {
      if (email.trim() === DEMO.email && password === DEMO.password) {
        setToken(email.trim());
        navigate("/", { replace: true });
      } else {
        setError("账号或密码错误");
        setBusy(false);
      }
    }, 450);
  }

  return (
    <div className="login-page">
      <aside className="login-hero">
        <div className="login-brand">
          <span className="brand-mark">电</span>
          <span>电商多 Agent</span>
        </div>
        <div className="login-hero-stage">
          <RobotMascot />
        </div>
        <div className="login-hero-caption">
          <h1 className="login-hero-title">运营助手</h1>
          <p className="login-hero-sub">选品规划 · 图像创意 · 库存履约，一站编排</p>
          <div className="login-hero-foot">本地优先 · 多 Agent 协同</div>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <h2 className="login-title">登录</h2>
          <p className="login-subtitle">使用演示账号进入后台</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="field">
              <span>账号</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@shop.local"
                autoFocus
              />
            </div>
            <div className="field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && <div className="notice notice-error login-error">{error}</div>}

            <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
              {busy ? "登录中…" : "登录"}
            </button>
          </form>

          <p className="login-hint">
            演示账号：<code>admin@shop.local</code> / <code>admin123</code>
          </p>
        </div>
      </main>
    </div>
  );
}
