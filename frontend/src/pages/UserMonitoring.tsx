import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

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

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function UserMonitoring() {
  const [rows, setRows] = useState<UserItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <PageHeader
        title="用户监控"
        subtitle="当前系统账号与登录情况（仅超级管理员可见）"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </button>
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
                    <span className={roleBadgeClass(u.role)}>{u.role}</span>
                  </td>
                  <td>{formatTime(u.createdAt)}</td>
                  <td>{formatTime(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
