import { useEffect, useMemo, useState } from "react";
import { getOrders } from "../api/orders";
import { getProducts } from "../api/products";
import type { Order, Product } from "../api/types";
import { PLATFORMS, platformLabel, platformMatches, platformTone } from "../platforms";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

type Tone = "ok" | "warn" | "bad" | "neutral";

// 订单状态 → 中文标签 + 配色（复用 .badge 体系）
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  READY_TO_SHIP: { label: "可发货", tone: "ok" },
  PENDING_ANALYSIS: { label: "待分析", tone: "warn" },
  NEEDS_REVIEW: { label: "需人工审核", tone: "bad" },
  INSUFFICIENT_STOCK: { label: "库存不足", tone: "bad" },
};
function statusMeta(s: string): { label: string; tone: Tone } {
  return STATUS_META[s] ?? { label: s, tone: "neutral" };
}

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
  function issuesOf(o: Order): string[] {
    const list: string[] = [];
    if (!o.paid) list.push("订单未付款");
    if (!o.addressComplete) list.push("收货地址不完整");
    if (o.status === "INSUFFICIENT_STOCK") list.push("库存不足");
    if (o.manualReviewRequired) list.push("需人工审核履约");
    return list;
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

  return (
    <section>
      <PageHeader title="订单" subtitle="订单履约看板：一眼看清哪些能发、哪些要处理。" />

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
              const issues = issuesOf(o);
              return (
                <div className="card order-card" key={o.id}>
                  <div className="order-head">
                    <div>
                      <span className="order-id">订单 #{o.id}</span>
                      <span className="muted order-time">{fmtTime(o.createdAt)}</span>
                    </div>
                    <div className="order-head-badges">
                      <Badge label={meta.label} tone={meta.tone} />
                      <span className={`badge badge-${platformTone(o.platform)}`}>
                        {platformLabel(o.platform)}
                      </span>
                    </div>
                  </div>

                  <div className="order-product">
                    {productName(o.productId)}
                    <span className="order-qty">× {o.quantity}</span>
                  </div>

                  <div className="order-meta">
                    <div className="order-meta-item">
                      <span className="muted">付款</span>
                      <Badge label={o.paid ? "已付款" : "未付款"} tone={o.paid ? "ok" : "neutral"} />
                    </div>
                    <div className="order-meta-item">
                      <span className="muted">收货地址</span>
                      <Badge
                        label={o.addressComplete ? "完整" : "不完整"}
                        tone={o.addressComplete ? "ok" : "bad"}
                      />
                    </div>
                    <div className="order-meta-item">
                      <span className="muted">履约建议</span>
                      <Badge label={meta.label} tone={meta.tone} />
                    </div>
                    <div className="order-meta-item">
                      <span className="muted">人工审核</span>
                      <Badge
                        label={o.manualReviewRequired ? "需审核" : "系统自动"}
                        tone={o.manualReviewRequired ? "warn" : "neutral"}
                      />
                    </div>
                  </div>

                  {issues.length > 0 && (
                    <div className="notice notice-warn order-issues">
                      <strong>待处理：</strong>
                      {issues.join(" · ")}
                    </div>
                  )}
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
