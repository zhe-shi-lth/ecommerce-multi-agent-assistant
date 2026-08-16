import { useCallback, useEffect, useState } from "react";
import Select from "../components/Select";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Icon } from "../components/icons";
import { getIdentity, isSuperAdmin } from "../auth";

interface UserItem {
  id: number;
  email: string;
  displayName: string | null;
  role: string;
  status: "ACTIVE" | "DISABLED";
  memberships: { companyName: string; role: string; storeName: string | null }[];
  createdAt: string | null;
  lastLoginAt: string | null;
}

function roleBadgeClass(role: string): string {
  if (role === "SUPER_ADMIN") return "badge badge-admin";
  if (role === "USER") return "badge badge-neutral";
  return "badge badge-neutral";
}

function accountLabel(user: UserItem): string {
  if (user.role === "SUPER_ADMIN") return "平台超级管理员";
  if (user.memberships.some((m) => m.role === "OWNER")) return "企业老板";
  if (user.memberships.length > 0) return "企业员工";
  return "未分配企业";
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

interface UserForm {
  email: string;
  password: string;
  role: "USER" | "PLATFORM_ADMIN" | "OWNER";
  companyId: number | null;
}

const EMPTY_FORM: UserForm = { email: "", password: "", role: "USER", companyId: null };

export default function UserMonitoring() {
  const [rows, setRows] = useState<UserItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UserForm>({ ...EMPTY_FORM, password: "123457", role: isSuperAdmin() ? "PLATFORM_ADMIN" : "USER" });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);

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
  useEffect(() => { if (isSuperAdmin()) api.get<{ id: number; name: string }[]>("/organization/companies").then(setCompanies); }, []);

  function openForm() {
    setForm({ ...EMPTY_FORM, password: "123457", role: isSuperAdmin() ? "PLATFORM_ADMIN" : "USER" });
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
        { email, displayName: form.email.split("@")[0], password: form.password, role: form.role, companyId: form.companyId },
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
  async function toggleStatus(user: UserItem) {
    const updated = await api.put<UserItem>(`/users/${user.id}/status`, { status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" });
    setRows((all) => all.map((x) => x.id === updated.id ? updated : x));
  }

  return (
    <div>
      <PageHeader
        title="用户监控"
        subtitle={isSuperAdmin() ? "平台用户、企业老板与员工的统一监控" : "本企业老板与员工的账号管理"}
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
          <table>
            <thead>
              <tr>
                <th>账号</th>
                <th>角色</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>最后登录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.email}>
                  <td>
                    <div className="user-cell">
                      <span className="avatar">{u.email.charAt(0).toUpperCase()}</span>
                      <span className="user-email">
                        {u.displayName ? <><strong>{u.displayName}</strong><small>{u.email}</small></> : u.email}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={roleBadgeClass(u.role)}>{accountLabel(u)}</span>
                  </td>
                  <td><span className={`badge ${u.status === "ACTIVE" ? "badge-ok" : "badge-bad"}`}>{u.status === "ACTIVE" ? "启用" : "已停用"}</span></td>
                  <td>{formatTime(u.createdAt)}</td>
                  <td>{formatTime(u.lastLoginAt)}</td>
                  <td><button className="btn btn-secondary btn-sm" disabled={u.status === "ACTIVE" && u.role === "SUPER_ADMIN"} onClick={() => void toggleStatus(u)}>{u.status === "ACTIVE" ? "停用" : "启用"}</button></td>
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
                <div className="field" style={{ marginBottom: 12 }}><span>账号类型</span><Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserForm["role"], companyId: e.target.value === "OWNER" && !isSuperAdmin() ? (getIdentity()?.companyId ?? null) : null }))}>{isSuperAdmin() ? <><option value="PLATFORM_ADMIN">平台运营管理员</option><option value="OWNER">企业老板</option></> : <><option value="USER">普通员工</option><option value="OWNER">联合老板</option></>}</Select></div>
                {form.role === "OWNER" && isSuperAdmin() && <div className="field" style={{ marginBottom: 12 }}><span>所属企业</span><Select value={form.companyId ?? ""} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value ? Number(e.target.value) : null }))}><option value="">请选择企业</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>}
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
