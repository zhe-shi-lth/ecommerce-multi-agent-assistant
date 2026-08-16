import { useEffect, useState } from "react";
import {
  getPlatformTasks,
  retryPlatformTask,
  type PlatformTask,
} from "../api/platformTasks";
import { errMsg } from "../utils/errMsg";

const LABEL: Record<string, string> = {
  PENDING: "待执行",
  RUNNING: "执行中",
  EXTERNAL_SUCCEEDED: "平台已成功",
  COMPLETED: "已完成",
  FAILED: "执行失败",
  NEEDS_RECONCILIATION: "需要对账",
};

export default function PlatformTaskPanel({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const [rows, setRows] = useState<PlatformTask[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getPlatformTasks(entityType, entityId);
        if (active) {
          setRows(next);
          setError(null);
        }
      } catch (requestError) {
        if (active) setError(errMsg(requestError));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [entityType, entityId]);

  const retry = async (id: number) => {
    setBusy(id);
    setError(null);
    try {
      const updated = await retryPlatformTask(id);
      setRows((current) => current.map((row) => (row.id === id ? updated : row)));
    } catch (requestError) {
      setError(errMsg(requestError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>平台执行记录</h3>
        <span className="card-sub">{rows.length} 条</span>
      </div>
      {error && <div className="notice notice-error" style={{ margin: 14 }}>{error}</div>}
      {rows.length === 0 ? (
        <div className="notice notice-info" style={{ margin: 14 }}>暂无平台操作记录。</div>
      ) : (
        rows.map((row) => (
          <div className="pr-row" key={row.id}>
            <div className="pr-row-name">{row.actionType}</div>
            <div className="pr-row-tags">
              <span className={`mini ${row.status === "COMPLETED" ? "ok" : ["FAILED", "NEEDS_RECONCILIATION"].includes(row.status) ? "bad" : "warn"}`}>
                {LABEL[row.status] ?? row.status}
              </span>
              <span className="mini neutral">尝试 {row.attemptCount}/{row.maxAttempts}</span>
              {row.lastError && <span className="mini bad">{row.lastError}</span>}
            </div>
            <div className="pr-row-spacer" />
            {["FAILED", "NEEDS_RECONCILIATION"].includes(row.status) && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={busy === row.id}
                onClick={() => void retry(row.id)}
              >
                立即重试
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
