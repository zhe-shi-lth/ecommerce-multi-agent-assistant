import { useEffect, useState } from "react";
import {
  getInventories,
  createInventory,
  type CreateInventoryInput,
} from "../api/inventories";
import { getProducts } from "../api/products";
import type { Inventory, Product } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const EMPTY_FORM: CreateInventoryInput = {
  productId: 0,
  currentStock: 0,
  safeStockThreshold: 0,
};

export default function Inventories() {
  const [rows, setRows] = useState<Inventory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateInventoryInput>(EMPTY_FORM);

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

  return (
    <section>
      <PageHeader title="库存" subtitle="按商品维护库存水位，支撑线二日常补货监控。" />
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id}>
                      <td className="col-id">{i.id}</td>
                      <td>{i.productId}</td>
                      <td>{i.currentStock}</td>
                      <td>{i.reservedStock}</td>
                      <td>{i.safeStockThreshold}</td>
                      <td>{i.purchaseCycleDays}</td>
                      <td>{i.salesLast7Days}</td>
                      <td>
                        <StatusBadge status={i.inventoryStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
