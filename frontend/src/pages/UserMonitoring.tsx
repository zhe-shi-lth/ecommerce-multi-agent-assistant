import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Icon } from "../components/icons";

interface UserItem {
  email: string;
  role: string;
  createdAt: string | null;
  lastLoginAt: string | null;
}

function roleBadgeClass(role: string): string {
  if (role === "SUPER_ADMIN") return "badge badge-ok";
  if (role === "USER") return "badge badge-neutral";
  return "badge badge-neutral";
}

function roleLabel(role: string): string {
  if (role === "SUPER_ADMIN") return "超级管理员";
  if (role === "USER") return "普通用户";
  return role;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

interface UserForm {
  email: string;
  password: string;
  role: string;
}

const EMPTY_FORM: UserForm = { email: "", password: "", role: "USER" };

export default function UserMonitoring() {
  const [rows, setRows] = useState<UserItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<UserItem[]>("/users")
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  function openForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    if (creating) return;
    setShowForm(false);
  }

  async function handleCreate() {
    setFormError(null);
    const email = form.email.trim();
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      setFormError("请输入有效的邮箱地址");
      return;
    }
    if (form.password.length < 6) {
      setFormError("密码至少 6 位");
      return;
    }
    setCreating(true);
    try {
      // silent: 由表单内联提示错误，避免再弹全局弹窗（重复弹窗）
      await api.post<UserItem>(
        "/users",
        { email, password: form.password, role: form.role },
        { silent: true },
      );
      setShowForm(false);
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="用户监控"
        subtitle="当前系统账号与登录情况（仅超级管理员可见）"
        icon={<Icon name="usermonitor" />}
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
              {loading ? "刷新中…" : "刷新"}
            </button>
            <button className="btn btn-primary btn-sm" onClick={openForm}>
              <Icon name="new" /> 添加新用户
            </button>
          </>
        }
      />

      {error && <div className="notice notice-error">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <EmptyState text="暂无账号" />
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="">
            <thead>
              <tr>
                <th>账号</th>
                <th>角色</th>
                <th>创建时间</th>
                <th>最后登录</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>
                    <span className={roleBadgeClass(u.role)}>{roleLabel(u.role)}</span>
                  </td>
                  <td>{formatTime(u.createdAt)}</td>
                  <td>{formatTime(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">添加新用户</div>
            <div className="modal-body">
              {formError && <div className="notice notice-error" style={{ marginBottom: 12 }}>{formError}</div>}
              <div className="field" style={{ marginBottom: 12 }}>
                <span>账号（邮箱）</span>
                <input
                  type="email"
                  value={form.email}
                  placeholder="user@shop.local"
                  autoFocus
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <span>密码（至少 6 位）</span>
                <input
                  type="password"
                  value={form.password}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="field" style={{ marginBottom: 4 }}>
                <span>角色</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="USER">普通用户</option>
                  <option value="SUPER_ADMIN">超级管理员</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeForm} disabled={creating}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? "创建中…" : "创建用户"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
