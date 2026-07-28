import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOperationPlans } from "../api/operations";
import type { OperationPlan } from "../api/types";
import { PLATFORMS, platformLabel, platformMatches, platformTone } from "../platforms";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Icon } from "../components/icons";

const CONFIRM_LABEL: Record<string, string> = {
  PENDING: "待你审核",
  CONFIRMED: "已发布",
  REJECTED: "已驳回",
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
  const navigate = useNavigate();

  useEffect(() => {
    getOperationPlans()
      .then(setPlans)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const [platform, setPlatform] = useState("ALL");

  // 线2 补货清单为商品级（跨平台库存监控），不受平台筛选限制，始终纳入。
  const isRestock = (p: OperationPlan) => p.line === "LINE2_RESTOCK";
  const filtered = useMemo(
    () => plans.filter((p) => isRestock(p) || platformMatches(p.platform, platform)),
    [plans, platform]
  );
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
          <div className="filter-bar" style={{ marginTop: 4 }}>
            <div className="filter-item">
              <label className="filter-label">平台</label>
              <select
                className="header-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="ALL">全部平台</option>
                {PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
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
                const title = planTitle(p);
                const summary = planSummary(p);
                const restock = p.line === "LINE2_RESTOCK";
                return (
                  <button
                    type="button"
                    className={`plan-card${pending ? " plan-card-pending" : ""}`}
                    key={p.id}
                    onClick={() => navigate(`/operation-plans/${p.id}`)}
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
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
