import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOperationPlans, unpublishOperationPlan } from "../api/operations";
import { approvePurchaseOrder, getPurchaseOrders, rejectPurchaseOrder } from "../api/purchase";
import { getProducts } from "../api/products";
import type { OperationPlan, Product, PurchaseOrder } from "../api/types";
import { PLATFORMS, platformLabel, platformMatches, platformTone } from "../platforms";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
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
const PO_STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "待审批",
  REJECTED: "已驳回",
  CREATED: "待采购",
  ORDERED: "已下单",
  INBOUND: "待入库",
  STOCKED: "已入库",
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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [tab, setTab] = useState<"listing" | "purchase">("listing");
  const navigate = useNavigate();

  async function loadAll() {
    setLoading(true);
    try {
      const [ops, pos, ps] = await Promise.all([getOperationPlans(), getPurchaseOrders(), getProducts()]);
      setPlans(ops);
      setPurchaseOrders(pos);
      setProducts(ps);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
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

  async function handlePurchaseDecision(id: number, decision: "approve" | "reject") {
    setActing(id);
    try {
      const updated =
        decision === "approve" ? await approvePurchaseOrder(id) : await rejectPurchaseOrder(id);
      setPurchaseOrders((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(String(e));
    } finally {
      setActing(null);
    }
  }

  const [platform, setPlatform] = useState("ALL");

  const listingPlans = useMemo(() => plans.filter((p) => p.line === "LINE1_ONBOARDING"), [plans]);
  // 未发布 = 尚未确认（confirmationStatus != CONFIRMED，含 PENDING / REJECTED）。
  const isUnpublished = (p: OperationPlan) => (p.confirmationStatus ?? "PENDING") !== "CONFIRMED";
  const filtered = useMemo(() => {
    if (platform === "UNPUBLISHED") return listingPlans.filter(isUnpublished);
    return listingPlans.filter((p) => platformMatches(p.platform, platform));
  }, [listingPlans, platform]);
  const pendingCount = filtered.filter((p) => (p.confirmationStatus ?? "PENDING") === "PENDING").length;
  const pendingPurchaseOrders = useMemo(
    () => purchaseOrders.filter((p) => p.status === "PENDING_APPROVAL"),
    [purchaseOrders]
  );
  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? `商品 #${id}`;
  const money = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n = typeof v === "number" ? v : Number(v);
    return Number.isNaN(n) ? "—" : `¥${n.toFixed(2)}`;
  };

  return (
    <section>
      <PageHeader
        title="运营计划"
        subtitle="统一审批中心：新品上架计划与采购申请分开处理。"
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
      {!loading && !error && (
        <>
          <div className="settings-tabs" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`settings-tab${tab === "listing" ? " active" : ""}`}
              onClick={() => setTab("listing")}
            >
              <Icon name="plans" /> 新品上架
            </button>
            <button
              type="button"
              className={`settings-tab${tab === "purchase" ? " active" : ""}`}
              onClick={() => setTab("purchase")}
            >
              <Icon name="purchase" /> 采购审批
              {pendingPurchaseOrders.length > 0 ? <span className="badge badge-warn">{pendingPurchaseOrders.length}</span> : null}
            </button>
          </div>
          {tab === "listing" && listingPlans.length === 0 && (
            <EmptyState text="暂无新品上架计划。可在「新品上架」走一遍流程，或运行 demo 脚本造数。" icon="🗂" />
          )}
          {tab === "listing" && listingPlans.length > 0 && (
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
                      {pending && <span className="badge badge-warn">待你审核</span>}
                    </div>
                    <p className="plan-card-summary">{summary}</p>
                    <div className="plan-card-meta">
                      <span>确认状态：{CONFIRM_LABEL[confirm] ?? confirm}</span>
                      <span>商品：#{p.productId}</span>
                      <span>
                        平台：
                        <span className={`badge badge-${platformTone(p.platform)}`}>
                          {platformLabel(p.platform)}
                        </span>
                      </span>
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
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
          {tab === "purchase" && (
            pendingPurchaseOrders.length === 0 ? (
              <EmptyState text="暂无待审批采购申请。" icon="✓" />
            ) : (
              <div className="plan-grid">
                {pendingPurchaseOrders.map((p) => {
                  const busy = acting === p.id;
                  return (
                    <div className="plan-card plan-card-pending" key={p.id}>
                      <div className="plan-card-head">
                        <span className="plan-card-title">{productName(p.productId)}</span>
                        <span className="badge badge-warn">{PO_STATUS_LABEL[p.status] ?? p.status}</span>
                      </div>
                      <p className="plan-card-summary">
                        申请补货 {p.quantity} 件，进货商家：{p.supplierName || "—"}，采购总成本 {money(p.totalCost)}
                      </p>
                      <div className="plan-card-meta">
                        <span>单价：{money(p.unitCost)}</span>
                        <span>进货运费：{money(p.purchaseShippingFee)}</span>
                        <span>预计到货：{p.expectedArrivalAt || "—"}</span>
                        <span className="muted">创建：{p.createdAt}</span>
                      </div>
                      {p.note ? <div className="plan-card-flag">备注：{p.note}</div> : null}
                      <div className="plan-card-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => handlePurchaseDecision(p.id, "approve")}
                        >
                          {busy ? "处理中…" : "审批通过"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={() => handlePurchaseDecision(p.id, "reject")}
                        >
                          驳回
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}
