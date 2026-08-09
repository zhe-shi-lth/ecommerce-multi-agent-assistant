import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrders, recheckAllOrders } from "../api/orders";
import { getProducts } from "../api/products";
import type { Order, Product } from "../api/types";
import { PLATFORMS, platformLabel, platformMatches, platformTone } from "../platforms";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Icon } from "../components/icons";

type Tone = "ok" | "warn" | "bad" | "neutral";

// 订单状态 → 中文标签 + 配色（复用 .badge 体系）
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  READY_TO_SHIP: { label: "可发货", tone: "ok" },
  PENDING_ANALYSIS: { label: "待分析", tone: "warn" },
  NEEDS_REVIEW: { label: "需人工审核", tone: "bad" },
  INSUFFICIENT_STOCK: { label: "库存不足", tone: "bad" },
  SHIPPED: { label: "已发货", tone: "ok" },
  REJECTED: { label: "已驳回", tone: "bad" },
};
function statusMeta(s: string): { label: string; tone: Tone } {
  return STATUS_META[s] ?? { label: s, tone: "neutral" };
}

// 待处理原因 → 中文标签（仅 status=PENDING_ANALYSIS 有值）。
const PENDING_REASON_LABEL: Record<string, string> = {
  UNPAID: "待付款",
  ADDRESS_INCOMPLETE: "地址不全",
  UNPAID_AND_ADDRESS: "未付款且地址不全",
};

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

interface Filters {
  keyword: string;
  status: string; // "ALL" 或具体状态
  productId: string; // "ALL" 或商品 id
  platform: string; // "ALL" 或具体平台
  paid: string; // ALL / PAID / UNPAID
  address: string; // ALL / COMPLETE / INCOMPLETE
  manualReview: string; // ALL / YES / NO
  pendingReason: string; // ALL / UNPAID / ADDRESS_INCOMPLETE / UNPAID_AND_ADDRESS
  onlyIssues: boolean;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  keyword: "",
  status: "ALL",
  productId: "ALL",
  platform: "ALL",
  paid: "ALL",
  address: "ALL",
  manualReview: "ALL",
  pendingReason: "ALL",
  onlyIssues: false,
  dateFrom: "",
  dateTo: "",
};

const PAGE_SIZES = [10, 20, 50];

export default function Orders() {
  const [rows, setRows] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    Promise.all([getOrders(), getProducts()])
      .then(([os, ps]) => {
        setRows(os);
        setProducts(ps);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  function productName(id: number): string {
    const p = products.find((x) => x.id === id);
    return p ? p.name : `商品 #${id}`;
  }

  function fmtTime(iso: string): string {
    return iso ? iso.slice(0, 16).replace("T", " ") : "";
  }
  function dayOf(iso: string): string {
    return iso ? iso.slice(0, 10) : "";
  }

  // 需要处理的订单（未付款 / 地址不全 / 库存不足 / 需审核）排在前，便于操作员优先处理。
  function issueCount(o: Order): number {
    let n = 0;
    if (!o.paid) n++;
    if (!o.addressComplete) n++;
    if (o.status === "INSUFFICIENT_STOCK" || o.manualReviewRequired) n++;
    return n;
  }

  // 任一筛选条件变化 → 回到第 1 页
  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const filtered = useMemo(() => {
    const kw = filters.keyword.trim().toLowerCase();
    return rows.filter((o) => {
      if (kw) {
        const name = productName(o.productId).toLowerCase();
        if (!String(o.id).includes(kw) && !name.includes(kw)) return false;
      }
      if (filters.status !== "ALL" && o.status !== filters.status) return false;
      if (filters.productId !== "ALL" && String(o.productId) !== filters.productId) return false;
      if (!platformMatches(o.platform, filters.platform)) return false;
      if (filters.paid === "PAID" && !o.paid) return false;
      if (filters.paid === "UNPAID" && o.paid) return false;
      if (filters.address === "COMPLETE" && !o.addressComplete) return false;
      if (filters.address === "INCOMPLETE" && o.addressComplete) return false;
      if (filters.manualReview === "YES" && !o.manualReviewRequired) return false;
      if (filters.manualReview === "NO" && o.manualReviewRequired) return false;
      if (filters.pendingReason !== "ALL" && (o.pendingReason ?? "") !== filters.pendingReason) return false;
      if (filters.onlyIssues && issueCount(o) === 0) return false;
      const day = dayOf(o.createdAt);
      if (filters.dateFrom && day < filters.dateFrom) return false;
      if (filters.dateTo && day > filters.dateTo) return false;
      return true;
    });
  }, [rows, products, filters]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => issueCount(b) - issueCount(a)),
    [filtered]
  );

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const startIdx = (current - 1) * pageSize;
  const paged = sorted.slice(startIdx, startIdx + pageSize);

  const hasFilter = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const insufficientCount = rows.filter((o) => o.status === "INSUFFICIENT_STOCK").length;

  // 批量「缺货订单状态刷新」：补货完成后按当前库存重算所有库存不足订单状态（不改动库存），刷新列表并提示结果。
  async function handleRecheckAll() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await recheckAllOrders();
      setRows(await getOrders()); // 刷新列表，反映翻回的状态
      const parts: string[] = [];
      if (res.readyToShip > 0) parts.push(`翻回可发货 ${res.readyToShip} 笔`);
      if (res.stillInsufficient > 0) parts.push(`仍不足 ${res.stillInsufficient} 笔`);
      if (res.other > 0) parts.push(`转其他态 ${res.other} 笔`);
      setFeedback({
        msg:
          res.total === 0
            ? "当前没有库存不足订单。"
            : `共刷新 ${res.total} 笔：${parts.join("，") || "无变化"}`,
        tone: res.readyToShip > 0 || (res.total > 0 && res.stillInsufficient === 0) ? "ok" : "error",
      });
    } catch (e) {
      setFeedback({ msg: String(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="订单"
        subtitle="订单履约看板：一眼看清哪些能发、哪些要处理。"
        icon={<Icon name="orders" />}
      />

      {!loading && !error && insufficientCount > 0 && (
        <div
          className="notice notice-error"
          style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <span>有 {insufficientCount} 笔订单因库存不足挂起（补货后点此刷新状态）。</span>
          <button className="btn btn-primary btn-sm" onClick={handleRecheckAll} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="refresh" />}
            缺货订单状态刷新
          </button>
        </div>
      )}
      {feedback && (
        <div className={`notice ${feedback.tone === "error" ? "notice-error" : "notice-ok"}`} style={{ marginBottom: 16 }}>
          {feedback.msg}
        </div>
      )}

      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && <div className="notice notice-error">加载失败：{error}</div>}

      {!loading && !error && rows.length > 0 && (
        <div className="filter-bar">
          <div className="filter-item filter-grow">
            <input
              className="filter-input"
              placeholder="搜索订单 ID 或商品名"
              value={filters.keyword}
              onChange={(e) => updateFilter("keyword", e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label className="filter-label">状态</label>
            <select
              className="header-select"
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
            >
              <option value="ALL">全部</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">商品</label>
            <select
              className="header-select"
              value={filters.productId}
              onChange={(e) => updateFilter("productId", e.target.value)}
            >
              <option value="ALL">全部</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">平台</label>
            <select
              className="header-select"
              value={filters.platform}
              onChange={(e) => updateFilter("platform", e.target.value)}
            >
              <option value="ALL">全部</option>
              {PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">付款</label>
            <select
              className="header-select"
              value={filters.paid}
              onChange={(e) => updateFilter("paid", e.target.value)}
            >
              <option value="ALL">全部</option>
              <option value="PAID">已付款</option>
              <option value="UNPAID">未付款</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">地址</label>
            <select
              className="header-select"
              value={filters.address}
              onChange={(e) => updateFilter("address", e.target.value)}
            >
              <option value="ALL">全部</option>
              <option value="COMPLETE">完整</option>
              <option value="INCOMPLETE">不完整</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">人工审核</label>
            <select
              className="header-select"
              value={filters.manualReview}
              onChange={(e) => updateFilter("manualReview", e.target.value)}
            >
              <option value="ALL">全部</option>
              <option value="YES">需审核</option>
              <option value="NO">系统自动</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">待处理原因</label>
            <select
              className="header-select"
              value={filters.pendingReason}
              onChange={(e) => updateFilter("pendingReason", e.target.value)}
            >
              <option value="ALL">全部</option>
              <option value="UNPAID">待付款</option>
              <option value="ADDRESS_INCOMPLETE">地址不全</option>
              <option value="UNPAID_AND_ADDRESS">未付款且地址不全</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">下单起</label>
            <input
              type="date"
              className="filter-input filter-date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label className="filter-label">下单止</label>
            <input
              type="date"
              className="filter-input filter-date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`btn btn-sm ${filters.onlyIssues ? "btn-primary" : "btn-secondary"}`}
            onClick={() => updateFilter("onlyIssues", !filters.onlyIssues)}
          >
            仅看待处理
          </button>
          {hasFilter && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              重置
            </button>
          )}
        </div>
      )}

      {!loading && !error && rows.length === 0 && <EmptyState text="暂无订单数据。" icon="🧾" />}

      {!loading && !error && rows.length > 0 && total === 0 && (
        <EmptyState text="没有符合筛选条件的订单，试试调整或重置筛选。" icon="🔍" />
      )}

      {!loading && !error && rows.length > 0 && total > 0 && (
        <>
          <div className="order-list">
            {paged.map((o) => {
              const meta = statusMeta(o.status);
              const issueN = issueCount(o);
              return (
                <div
                  className="order-row"
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/orders/${o.id}`);
                  }}
                >
                  <div className="order-row-id">
                    <div>订单 #{o.id}</div>
                    <div className="order-row-time">{fmtTime(o.createdAt)}</div>
                  </div>

                  <div className="order-row-main">
                    <div className="order-row-prod">
                      <span className="name">{productName(o.productId)}</span>
                      <span className="qty">× {o.quantity}</span>
                      <span className={`badge badge-${platformTone(o.platform)}`}>
                        {platformLabel(o.platform)}
                      </span>
                    </div>
                    <div className="order-row-mini">
                      <span className={`mini ${o.paid ? "ok" : "neutral"}`}>
                        {o.paid ? "已付款" : "未付款"}
                      </span>
                      <span className={`mini ${o.addressComplete ? "ok" : "bad"}`}>
                        {o.addressComplete ? "地址完整" : "地址不全"}
                      </span>
                      {o.manualReviewRequired && <span className="mini warn">需审核</span>}
                      {o.pendingReason && PENDING_REASON_LABEL[o.pendingReason] && (
                        <span className="mini bad">{PENDING_REASON_LABEL[o.pendingReason]}</span>
                      )}
                      {issueN > 0 && <span className="mini bad">待处理 {issueN}</span>}
                    </div>
                  </div>

                  <div className="order-row-right">
                    <Badge label={meta.label} tone={meta.tone} />
                    <span className="order-chevron">›</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pager">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              上一页
            </button>
            <span className="pager-info">
              第 {current} / {pageCount} 页 · 共 {total} 条
            </span>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              下一页
            </button>
            <span className="pager-size">
              每页
              <select
                className="header-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              条
            </span>
          </div>
        </>
      )}
    </section>
  );
}
