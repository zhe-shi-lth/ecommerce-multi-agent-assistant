import { useEffect, useState } from "react";
import {
  getInventories,
  createInventory,
  updateInventory,
  type CreateInventoryInput,
} from "../api/inventories";
import { getProducts } from "../api/products";
import type { Inventory, Product } from "../api/types";
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

  // 补货弹窗状态
  const [replenishTarget, setReplenishTarget] = useState<Inventory | null>(null);
  const [replenishQty, setReplenishQty] = useState("");
  const [replenishBusy, setReplenishBusy] = useState(false);
  const [replenishError, setReplenishError] = useState<string | null>(null);

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

  function setField(key: keyof CreateInventoryInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value === "" ? 0 : Number(value) }));
  }

  // 库存记录只存 productId，表格里需要回查商品名称展示。
  function productName(id: number): string {
    const p = products.find((x) => x.id === id);
    return p ? p.name : `#${id}`;
  }

  function openReplenish(inv: Inventory) {
    setReplenishTarget(inv);
    setReplenishQty("");
    setReplenishError(null);
  }

  function cancelReplenish() {
    setReplenishTarget(null);
    setReplenishQty("");
    setReplenishError(null);
  }

  async function handleReplenish() {
    if (!replenishTarget) return;
    const add = Number(replenishQty);
    if (!(add > 0)) return;
    setReplenishBusy(true);
    setReplenishError(null);
    try {
      const newStock = replenishTarget.currentStock + add;
      const updated = await updateInventory(replenishTarget.id, {
        productId: replenishTarget.productId,
        currentStock: newStock,
        safeStockThreshold: replenishTarget.safeStockThreshold,
        reservedStock: replenishTarget.reservedStock,
        purchaseCycleDays: replenishTarget.purchaseCycleDays,
        salesLast7Days: replenishTarget.salesLast7Days,
        inventoryStatus: computeStatus(newStock, replenishTarget.safeStockThreshold),
      });
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      cancelReplenish();
    } catch (e) {
      setReplenishError(String(e));
    } finally {
      setReplenishBusy(false);
    }
  }

  const replenishValid = replenishTarget != null && Number(replenishQty) > 0;

  return (
    <section>
      <PageHeader
        title="库存"
        subtitle="按商品维护库存水位，支撑线二日常补货监控。"
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

          {showForm && (
            <div className="listing-form" style={{ marginBottom: 16 }}>
              <div className="field">
                <span>商品 *</span>
                <select value={form.productId || ""} onChange={(e) => setField("productId", e.target.value)}>
                  <option value="">请选择商品</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id} {p.name}
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
              <div className="export-actions">
                <button className="btn btn-primary" onClick={handleAdd} disabled={busy || !form.productId}>
                  {busy ? "保存中…" : "保存库存"}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={busy}>
                  取消
                </button>
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState text="还没有库存记录，点右上角「新建库存」添加。" icon="📊" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th>商品</th>
                    <th>当前库存</th>
                    <th>预留</th>
                    <th>安全阈值</th>
                    <th>采购周期(天)</th>
                    <th>近7天销量</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id}>
                      <td className="col-id">{i.id}</td>
                      <td>{productName(i.productId)}</td>
                      <td>{i.currentStock}</td>
                      <td>{i.reservedStock}</td>
                      <td>{i.safeStockThreshold}</td>
                      <td>{i.purchaseCycleDays}</td>
                      <td>{i.salesLast7Days}</td>
                      <td>
                        <StatusBadge status={i.inventoryStatus} />
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openReplenish(i)}>
                          补货
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {replenishTarget && (
        <div className="modal-overlay" onClick={cancelReplenish}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">补货 · {productName(replenishTarget.productId)}</div>
            <div className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>
                当前库存：{replenishTarget.currentStock}（安全阈值 {replenishTarget.safeStockThreshold}）
              </p>
              <div className="field" style={{ marginTop: 8 }}>
                <span>补货数量 *</span>
                <input
                  type="number"
                  min={1}
                  value={replenishQty}
                  onChange={(e) => setReplenishQty(e.target.value)}
                  autoFocus
                />
              </div>
              {replenishError && <div className="error" style={{ marginTop: 8 }}>{replenishError}</div>}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cancelReplenish} disabled={replenishBusy}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleReplenish}
                disabled={replenishBusy || !replenishValid}
              >
                {replenishBusy ? "提交中…" : "确认补货"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
