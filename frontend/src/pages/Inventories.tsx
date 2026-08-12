import { useEffect, useState } from "react";
import {
  getInventories,
  createInventory,
  adjustInventory,
  getInventoryMovements,
  type CreateInventoryInput,
} from "../api/inventories";
import { getProducts } from "../api/products";
import type { Inventory, InventoryMovement, Product } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Icon } from "../components/icons";

const EMPTY_FORM: CreateInventoryInput = {
  productId: 0,
  currentStock: 0,
  safeStockThreshold: 0,
};

// 与服务端 recomputeStatus 规则保持一致，补货后重算水位徽章。
function computeStatus(currentStock: number, safeThreshold: number): string {
  if (currentStock < safeThreshold) return "RISK";
  if (currentStock < safeThreshold * 2) return "LOW";
  return "ENOUGH";
}

export default function Inventories() {
  const [rows, setRows] = useState<Inventory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateInventoryInput>(EMPTY_FORM);
  const [activeInventory, setActiveInventory] = useState<Inventory | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [adjustStock, setAdjustStock] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  function refreshAll() {
    setLoading(true);
    Promise.all([getInventories(), getProducts()])
      .then(([is, ps]) => {
        setRows(is);
        setProducts(ps);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(refreshAll, []);

  async function handleAdd() {
    setBusy(true);
    try {
      await createInventory(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setRows(await getInventories());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openInventory(inventory: Inventory) {
    setActiveInventory(inventory);
    setAdjustStock(inventory.currentStock);
    setAdjustReason("");
    setMovements([]);
    try {
      setMovements(await getInventoryMovements(inventory.id));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleAdjust() {
    if (!activeInventory || !adjustReason.trim()) return;
    setBusy(true);
    try {
      const updated = await adjustInventory(activeInventory.id, adjustStock, adjustReason.trim());
      setRows((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      setActiveInventory(updated);
      setAdjustReason("");
      setMovements(await getInventoryMovements(updated.id));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function setField(key: keyof CreateInventoryInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value === "" ? 0 : Number(value) }));
  }

  // 库存记录只存 productId，表格里需要回查商品名称展示。
  function productName(id: number): string {
    const p = products.find((x) => x.id === id);
    return p ? p.name : `#${id}`;
  }

  return (
    <section>
      <PageHeader
        title="库存"
        subtitle="按商品维护库存水位，支撑日常补货监控。"
        icon={<Icon name="inventory" />}
      />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && <div className="notice notice-error">出错：{error}</div>}

      {!loading && !error && (
        <div className="card">
          <div className="card-header">
            <h3>库存列表</h3>
            {!showForm && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                新建库存
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState text="还没有库存记录，点右上角「新建库存」添加。" icon="📊" />
          ) : (
            <div className="entity-grid">
              {rows.map((i) => {
                const available = i.currentStock - i.reservedStock;
                const status = computeStatus(available, i.safeStockThreshold);
                const max = Math.max(available, i.safeStockThreshold * 2, 1);
                const fillPct = Math.min(100, (available / max) * 100);
                const thPct = Math.min(100, (i.safeStockThreshold / max) * 100);
                const stockCls =
                  status === "RISK" ? "risk" : status === "LOW" ? "low" : "enough";
                return (
                  <div className="inv-card" key={i.id}>
                    <div className="inv-card-head">
                      <span className="inv-card-title">{productName(i.productId)}</span>
                      <StatusBadge status={i.inventoryStatus} />
                    </div>
                    <div className="inv-stock-row">
                      <span className={`inv-stock ${stockCls}`}>{i.currentStock}</span>
                      <span className="inv-stock-unit">件在库</span>
                    </div>
                    <div className="stock-bar" title={`可用 ${available} / 实物 ${i.currentStock} / 安全阈值 ${i.safeStockThreshold}`}>
                      <div
                        className={`stock-bar-fill ${stockCls}`}
                        style={{ width: `${fillPct}%` }}
                      />
                      <div
                        className="stock-bar-threshold"
                        style={{ left: `${thPct}%` }}
                        title={`安全阈值 ${i.safeStockThreshold}`}
                      />
                    </div>
                    <div className="inv-detail">
                      <div>
                        <div className="k">安全阈值</div>
                        <div className="v">{i.safeStockThreshold}</div>
                      </div>
                      <div>
                        <div className="k">预留</div>
                        <div className="v">{i.reservedStock}</div>
                      </div>
                      <div>
                        <div className="k">采购周期</div>
                        <div className="v">{i.purchaseCycleDays} 天</div>
                      </div>
                      <div>
                        <div className="k">近7天销量</div>
                        <div className="v">{i.salesLast7Days}</div>
                      </div>
                    </div>
                    <div className="inv-card-actions">
                      <span className="muted" style={{ fontSize: 12 }}>
                        补货请到「采购补货」
                      </span>
                      <button className="btn btn-secondary btn-sm" onClick={() => openInventory(i)}>
                        流水与盘点
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div
          className="modal-overlay"
          onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
        >
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">新建库存</div>
            <div className="modal-body">
              <div className="listing-form" style={{ marginTop: 0 }}>
                <div className="field">
                  <span>商品 *</span>
                  <select value={form.productId || ""} onChange={(e) => setField("productId", e.target.value)}>
                    <option value="">请选择商品</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} · {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="listing-form" style={{ flexDirection: "row", gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <span>当前库存 *</span>
                    <input type="number" value={form.currentStock} onChange={(e) => setField("currentStock", e.target.value)} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <span>安全阈值 *</span>
                    <input type="number" value={form.safeStockThreshold} onChange={(e) => setField("safeStockThreshold", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                disabled={busy}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={busy || !form.productId}
              >
                {busy ? "保存中…" : "保存库存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeInventory && (
        <div className="modal-overlay" onClick={() => setActiveInventory(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-title">
              {productName(activeInventory.productId)} · 库存流水与盘点
            </div>
            <div className="modal-body">
              <div className="listing-form" style={{ marginTop: 0 }}>
                <div className="notice notice-info">
                  实物库存 {activeInventory.currentStock}，已预留 {activeInventory.reservedStock}，
                  可用库存 {activeInventory.currentStock - activeInventory.reservedStock}
                </div>
                <div className="listing-form" style={{ flexDirection: "row", gap: 12 }}>
                  <label className="field" style={{ flex: 1 }}>
                    <span>盘点后实物库存</span>
                    <input type="number" min={activeInventory.reservedStock} value={adjustStock}
                      onChange={(e) => setAdjustStock(Number(e.target.value))} />
                  </label>
                  <label className="field" style={{ flex: 2 }}>
                    <span>调整原因 *</span>
                    <input value={adjustReason} placeholder="例如：仓库实盘差异"
                      onChange={(e) => setAdjustReason(e.target.value)} />
                  </label>
                  <button className="btn btn-primary" onClick={handleAdjust}
                    disabled={busy || !adjustReason.trim() || adjustStock < activeInventory.reservedStock}>
                    确认盘点
                  </button>
                </div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  {movements.length === 0 ? (
                    <div className="notice notice-info">暂无库存流水。</div>
                  ) : movements.map((movement) => (
                    <div className="pr-row" key={movement.id}>
                      <div className="pr-row-name">{movement.movementType}</div>
                      <div className="pr-row-tags">
                        <span className="mini neutral">实物 {movement.currentDelta >= 0 ? "+" : ""}{movement.currentDelta}</span>
                        <span className="mini neutral">预留 {movement.reservedDelta >= 0 ? "+" : ""}{movement.reservedDelta}</span>
                        <span className="mini neutral">结余 {movement.currentAfter} / 预留 {movement.reservedAfter}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{movement.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setActiveInventory(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
