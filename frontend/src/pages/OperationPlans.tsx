import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteOperationPlan, getOperationPlans, unpublishOperationPlan } from "../api/operations";
import type { OperationPlan } from "../api/types";
import { PLATFORMS, platformLabel, platformMatches, platformTone } from "../platforms";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import AlertModal from "../components/AlertModal";
import { Icon } from "../components/icons";

const CONFIRM_LABEL: Record<string, string> = {
  PENDING: "待你审核",
  CONFIRMED: "已发布",
  REJECTED: "已驳回",
};

const PLATFORM_FILTERS = [
  { key: "ALL", label: "全部平台", tone: "neutral" as const },
  ...PLATFORMS.map((p) => ({ key: p.key, label: p.label, tone: p.tone })),
  { key: "UNPUBLISHED", label: "未发布", tone: "warn" as const },
];
const TONE_COLOR: Record<string, string> = {
  taobao: "#ff6000",
  douyin: "#1f6fff",
  xhs: "#ff2e4d",
  neutral: "var(--text-2)",
  warn: "var(--warn)",
};

function planTitle(p: OperationPlan): string {
  if (p.line === "LINE2_RESTOCK") {
    return `补货计划清单 · 商品 #${p.productId}`;
  }
  const t = p.productPlanJson?.["recommended_title"];
  return typeof t === "string" && t ? t : `计划 #${p.id}`;
}

function planSummary(p: OperationPlan): string {
  if (p.line === "LINE2_RESTOCK") {
    return p.finalSummary || "（补货计划清单）";
  }
  const s = p.productPlanJson?.["detail_description"];
  if (typeof s === "string" && s) return s;
  return p.finalSummary || "（暂无摘要）";
}

export default function OperationPlans() {
  const [plans, setPlans] = useState<OperationPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null); // 正在删除/下架的计划 id
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getOperationPlans()
      .then(setPlans)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleUnpublish(id: number) {
    setActing(id);
    try {
      const updated = await unpublishOperationPlan(id);
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(String(e));
    } finally {
      setActing(null);
    }
  }

  async function handleDeleteConfirm() {
    if (confirmDelete == null) return;
    setActing(confirmDelete);
    try {
      await deleteOperationPlan(confirmDelete);
      setPlans((prev) => prev.filter((p) => p.id !== confirmDelete));
    } catch (e) {
      setError(String(e));
    } finally {
      setActing(null);
      setConfirmDelete(null);
    }
  }

  const [platform, setPlatform] = useState("ALL");

  // 线2 补货清单为商品级（跨平台库存监控），不受平台筛选限制，始终纳入。
  const isRestock = (p: OperationPlan) => p.line === "LINE2_RESTOCK";
  // 未发布 = 尚未确认（confirmationStatus != CONFIRMED，含 PENDING / REJECTED）。
  const isUnpublished = (p: OperationPlan) => (p.confirmationStatus ?? "PENDING") !== "CONFIRMED";
  const filtered = useMemo(() => {
    if (platform === "UNPUBLISHED") return plans.filter(isUnpublished);
    return plans.filter((p) => isRestock(p) || platformMatches(p.platform, platform));
  }, [plans, platform]);
  const pendingCount = filtered.filter((p) => (p.confirmationStatus ?? "PENDING") === "PENDING").length;

  return (
    <section>
      <PageHeader
        title="运营计划"
        subtitle="Agent 自动生成的选品、创意、库存与履约方案。待你审核的计划会标记出来，点击查看详情。"
        icon={<Icon name="plans" />}
      />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && (
        <div className="notice notice-error">加载失败：{error}（请确认 Java 服务已启动且有数据）</div>
      )}
      {!loading && !error && plans.length === 0 && (
        <EmptyState text="暂无运营计划。可在「新品上架」走一遍流程，或运行 demo 脚本造数。" icon="🗂" />
      )}
      {!loading && !error && plans.length > 0 && (
        <>
          <div className="platform-filter">
            {PLATFORM_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`pf-pill${platform === f.key ? " active" : ""}`}
                data-tone={f.tone}
                onClick={() => setPlatform(f.key)}
              >
                <span className="pf-dot" style={{ background: TONE_COLOR[f.tone] }} />
                {f.label}
              </button>
            ))}
          </div>
          {pendingCount > 0 && (
            <div className="notice notice-warn">有 {pendingCount} 个计划待你审核确认后才会发布商品。</div>
          )}
          {filtered.length === 0 ? (
            <EmptyState text="没有符合平台筛选条件的计划，试试切换平台。" icon="🔍" />
          ) : (
            <div className="plan-grid">
              {filtered.map((p) => {
                const confirm = p.confirmationStatus ?? "PENDING";
                const pending = confirm === "PENDING";
                const published = confirm === "CONFIRMED";
                const title = planTitle(p);
                const summary = planSummary(p);
                const restock = p.line === "LINE2_RESTOCK";
                const busy = acting === p.id;
                return (
                  <div
                    className={`plan-card${pending ? " plan-card-pending" : ""}`}
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/operation-plans/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(`/operation-plans/${p.id}`);
                    }}
                  >
                    <div className="plan-card-head">
                      <span className="plan-card-title">{title}</span>
                      {restock ? (
                        <span className="badge badge-info">补货计划清单</span>
                      ) : (
                        pending && <span className="badge badge-warn">待你审核</span>
                      )}
                    </div>
                    <p className="plan-card-summary">{summary}</p>
                    <div className="plan-card-meta">
                      <span>确认状态：{CONFIRM_LABEL[confirm] ?? confirm}</span>
                      <span>商品：#{p.productId}</span>
                      {!restock && (
                        <span>
                          平台：
                          <span className={`badge badge-${platformTone(p.platform)}`}>
                            {platformLabel(p.platform)}
                          </span>
                        </span>
                      )}
                      <span className="muted">创建：{p.createdAt}</span>
                    </div>
                    {p.manualReviewRequired && (
                      <div className="plan-card-flag">⚠ 需人工复核</div>
                    )}
                    <div className="plan-card-actions">
                      {published ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnpublish(p.id);
                          }}
                        >
                          {busy ? "下架中…" : "下架"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(p.id);
                          }}
                        >
                          {busy ? "删除中…" : "删除"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {confirmDelete != null && (
        <AlertModal
          open
          title="删除运营计划"
          message={`确定删除计划 #${confirmDelete} 吗？该操作不可恢复。`}
          confirmText="删除"
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </section>
  );
}
