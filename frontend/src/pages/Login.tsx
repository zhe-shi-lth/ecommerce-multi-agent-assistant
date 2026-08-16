import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { applyAuth, isAuthed, type AuthResult } from "../auth";
import { api } from "../api/client";
import RobotMascot from "../components/RobotMascot";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 已登录则直接进后台
  if (isAuthed()) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("请输入账号和密码");
      return;
    }
    setBusy(true);
    try {
      const result = await api.post<AuthResult>("/auth/login", {
        email: email.trim(),
        password,
      });
      applyAuth(result);
      // 整页跳转：触发 App 重新挂载并重新校验 token，避免登录后白屏
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setBusy(false);
    }
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
          <p className="login-subtitle">使用账号进入后台</p>

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

        </div>
      </main>
    </div>
  );
}
