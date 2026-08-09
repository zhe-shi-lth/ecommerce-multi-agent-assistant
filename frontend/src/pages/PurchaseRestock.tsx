import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  markOrdered,
  markInbound,
  stockIn,
} from "../api/purchase";
import { getInsufficientSummary, recheckProductOrders } from "../api/orders";
import { getProducts } from "../api/products";
import type {
  InsufficientStockSummary,
  Product,
  PurchaseOrder,
  RecheckAllResult,
} from "../api/types";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

// 采购单生命周期 → 中文标签 + 配色
const PO_STATUS_META: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  CREATED: { label: "待采购", tone: "warn" },
  ORDERED: { label: "已下单", tone: "neutral" },
  INBOUND: { label: "待入库", tone: "warn" },
  STOCKED: { label: "已入库", tone: "ok" },
};
function poStatusMeta(s: string): { label: string; tone: "ok" | "warn" | "bad" | "neutral" } {
  return PO_STATUS_META[s] ?? { label: s, tone: "neutral" };
}

type Tone = "ok" | "warn" | "bad" | "neutral";

function recheckMsg(r: RecheckAllResult): string {
  const parts: string[] = [];
  if (r.readyToShip > 0) parts.push(`翻回可发货 ${r.readyToShip} 笔`);
  if (r.stillInsufficient > 0) parts.push(`仍不足 ${r.stillInsufficient} 笔`);
  if (r.other > 0) parts.push(`转其他态 ${r.other} 笔`);
  return r.total === 0 ? "无缺货订单" : `共 ${r.total} 笔：${parts.join("，") || "无变化"}`;
}

export default function PurchaseRestock() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [insufficient, setInsufficient] = useState<InsufficientStockSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);
  // 每个缺货商品建议的补货量（默认 = 缺口，可改）
  const [suggestQty, setSuggestQty] = useState<Record<number, number>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const [pos, ins, ps] = await Promise.all([
        getPurchaseOrders(),
        getInsufficientSummary(),
        getProducts(),
      ]);
      setOrders(pos);
      setInsufficient(ins);
      setProducts(ps);
      setSuggestQty((prev) => {
        const next = { ...prev };
        for (const s of ins) if (next[s.productId] == null) next[s.productId] = s.shortQuantity;
        return next;
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function productName(id: number): string {
    const p = products.find((x) => x.id === id);
    return p ? p.name : `商品 #${id}`;
  }

  const created = useMemo(
    () => orders.filter((o) => o.status === "CREATED" || o.status === "ORDERED"),
    [orders]
  );
  const inbound = useMemo(() => orders.filter((o) => o.status === "INBOUND"), [orders]);
  const stocked = useMemo(() => orders.filter((o) => o.status === "STOCKED"), [orders]);

  const insufficientOrderCount = insufficient.reduce((sum, s) => sum + s.orderCount, 0);

  async function run<T>(p: Promise<T>, okMsg: (r: T) => string) {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await p;
      setFeedback({ msg: okMsg(r), tone: "ok" });
      await loadAll();
    } catch (e: unknown) {
      setFeedback({ msg: String((e as Error)?.message ?? e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function handleCreate(productId: number) {
    const quantity = Math.max(1, suggestQty[productId] ?? 0);
    run(
      createPurchaseOrder({ productId, quantity }),
      () => `已为「${productName(productId)}」创建采购单（${quantity} 件，待采购）`
    );
  }

  function handleStockIn(id: number) {
    run(stockIn(id), (r) => `已入库，库存已增加；${recheckMsg(r.recheck)}`);
  }

  function handleRefreshOrders(productId: number) {
    run(
      recheckProductOrders(productId),
      (r) => `已刷新「${productName(productId)}」相关缺货订单：${recheckMsg(r)}`
    );
  }

  if (loading)
    return (
      <div className="loading">
        <span className="spinner" />
        加载中…
      </div>
    );
  if (error) return <div className="notice notice-error">加载失败：{error}</div>;

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 14px",
        borderBottom: "1px solid #f0f1f4",
      }}
    >
      {children}
    </div>
  );
  const Badge = ({ label, tone }: { label: string; tone: Tone }) => (
    <span className={`badge badge-${tone}`}>{label}</span>
  );

  return (
    <section>
      <PageHeader
        title="采购补货"
        subtitle="库存处理工作台（线2）：补货建议 → 采购单 → 入库 → 自动刷新缺货订单"
        icon={<Icon name="purchase" />}
      />

      <div className="notice notice-info" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span>
          当前关联缺货订单 <b>{insufficientOrderCount}</b> 笔（{insufficient.length} 个商品）。
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/orders?status=INSUFFICIENT_STOCK")}
        >
          <Icon name="orders" /> 查看缺货订单
        </button>
      </div>

      {feedback && (
        <div className={`notice ${feedback.tone === "error" ? "notice-error" : "notice-ok"}`} style={{ marginBottom: 16 }}>
          {feedback.msg}
        </div>
      )}

      {/* 板块 1：待确认补货建议（由库存不足汇总派生） */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>待确认补货建议</h3>
          <span className="card-sub">{insufficient.length} 个商品库存不足</span>
        </div>
        {insufficient.length === 0 ? (
          <div className="notice notice-ok" style={{ margin: 14 }}>
            暂无可补货建议，所有商品库存充足。
          </div>
        ) : (
          insufficient.map((s) => (
            <Row key={s.productId}>
              <div style={{ minWidth: 160, fontWeight: 600 }}>{s.productName}</div>
              <span className="mini bad">积压 {s.orderCount} 笔</span>
              <span className="mini bad">缺 {s.shortQuantity} 件</span>
              <span className="mini neutral">当前库存 {s.currentStock}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#5b5f6b" }}>建议补货</span>
                <input
                  className="filter-input"
                  style={{ width: 88 }}
                  type="number"
                  min={1}
                  value={suggestQty[s.productId] ?? s.shortQuantity}
                  onChange={(e) =>
                    setSuggestQty((p) => ({ ...p, [s.productId]: Number(e.target.value) }))
                  }
                />
                <span style={{ fontSize: 13, color: "#5b5f6b" }}>件</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => handleCreate(s.productId)}
              >
                <Icon name="plus" /> 创建采购单
              </button>
            </Row>
          ))
        )}
      </div>

      {/* 板块 2：已创建采购单（待采购 / 已下单） */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>已创建采购单</h3>
          <span className="card-sub">{created.length} 单</span>
        </div>
        {created.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>
            暂无采购单，可在上方「待确认补货建议」创建。
          </div>
        ) : (
          created.map((o) => (
            <Row key={o.id}>
              <div style={{ minWidth: 160, fontWeight: 600 }}>{productName(o.productId)}</div>
              <Badge label={poStatusMeta(o.status).label} tone={poStatusMeta(o.status).tone} />
              <span className="mini neutral">{o.quantity} 件</span>
              <span className="mini neutral">{o.supplier || "供应商未填"}</span>
              <div style={{ flex: 1 }} />
              {o.status === "CREATED" && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(markOrdered(o.id), () => "已标记为已下单")}>
                  标记已下单
                </button>
              )}
              {o.status === "ORDERED" && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(markInbound(o.id), () => "已标记为待入库")}>
                  标记待入库
                </button>
              )}
            </Row>
          ))
        )}
      </div>

      {/* 板块 3：待入库 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>待入库</h3>
          <span className="card-sub">{inbound.length} 单</span>
        </div>
        {inbound.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>
            没有待入库的采购单。
          </div>
        ) : (
          inbound.map((o) => (
            <Row key={o.id}>
              <div style={{ minWidth: 160, fontWeight: 600 }}>{productName(o.productId)}</div>
              <Badge label={poStatusMeta(o.status).label} tone={poStatusMeta(o.status).tone} />
              <span className="mini neutral">{o.quantity} 件</span>
              <span className="mini neutral">{o.supplier || "供应商未填"}</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleStockIn(o.id)}>
                <Icon name="check" /> 确认入库
              </button>
            </Row>
          ))
        )}
      </div>

      {/* 板块 4：已入库记录（可手动再触发缺货订单刷新） */}
      <div className="card">
        <div className="card-header">
          <h3>已入库记录</h3>
          <span className="card-sub">{stocked.length} 单</span>
        </div>
        {stocked.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>
            还没有已入库的采购单。
          </div>
        ) : (
          stocked.map((o) => (
            <Row key={o.id}>
              <div style={{ minWidth: 160, fontWeight: 600 }}>{productName(o.productId)}</div>
              <Badge label={poStatusMeta(o.status).label} tone={poStatusMeta(o.status).tone} />
              <span className="mini neutral">{o.quantity} 件</span>
              <span className="mini neutral">{o.supplier || "供应商未填"}</span>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => handleRefreshOrders(o.productId)}
                title="按当前库存重新判定该商品的缺货订单"
              >
                <Icon name="refresh" /> 自动刷新相关缺货订单
              </button>
            </Row>
          ))
        )}
      </div>
    </section>
  );
}
