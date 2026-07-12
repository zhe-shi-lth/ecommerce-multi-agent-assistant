import { useEffect, useState } from "react";
import {
  getProducts,
  createProduct,
  type CreateProductInput,
} from "../api/products";
import { getCategories, createCategory } from "../api/categories";
import type { Product, Category } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const EMPTY_FORM: CreateProductInput = {
  name: "",
  category: "",
  description: "",
  costPrice: 0,
  salePrice: 0,
  targetAudience: "",
  usageScenario: "",
};

export default function Products() {
  const [rows, setRows] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState("");

  const [showProductForm, setShowProductForm] = useState(false);
  const [form, setForm] = useState<CreateProductInput>(EMPTY_FORM);

  function refreshAll() {
    setLoading(true);
    Promise.all([getProducts(), getCategories()])
      .then(([ps, cs]) => {
        setRows(ps);
        setCategories(cs);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(refreshAll, []);

  async function handleAddCategory() {
    if (!catName.trim()) return;
    setBusy(true);
    try {
      await createCategory(catName.trim());
      setCatName("");
      setShowCatForm(false);
      setCategories(await getCategories());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddProduct() {
    setBusy(true);
    try {
      await createProduct(form);
      setForm(EMPTY_FORM);
      setShowProductForm(false);
      setRows(await getProducts());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function setField(key: keyof CreateProductInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section>
      <PageHeader
        title="商品"
        subtitle="管理品类基础数据与商品目录。商品是线一上架的源头。"
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
            <h3>商品</h3>
            {!showProductForm && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowProductForm(true)}>
                新建商品
              </button>
            )}
          </div>

          {/* 紧凑品类条：标签 + 添加，不单独占行 */}
          <div className="cat-bar">
            <span className="cat-bar-label">品类</span>
            <div className="cat-chips">
              {categories.map((c) => (
                <span className="cat-chip" key={c.id}>
                  {c.name}
                </span>
              ))}
              {showCatForm ? (
                <span className="cat-add-inline">
                  <input
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="如：家居 / 美妆"
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleAddCategory} disabled={busy || !catName.trim()}>
                    {busy ? "保存中…" : "保存"}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowCatForm(false)} disabled={busy}>
                    取消
                  </button>
                </span>
              ) : (
                <button className="cat-add-btn" onClick={() => setShowCatForm(true)}>
                  + 添加品类
                </button>
              )}
            </div>
          </div>

          {showProductForm && (
            <div className="listing-form" style={{ marginBottom: 16 }}>
              <div className="field">
                <span>名称 *</span>
                <input value={form.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="field">
                <span>类目 *</span>
                <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                  <option value="">请选择品类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span>描述 *</span>
                <textarea rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} />
              </div>
              <div className="listing-form" style={{ flexDirection: "row", gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <span>成本价</span>
                  <input type="number" value={form.costPrice} onChange={(e) => setField("costPrice", e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <span>售价</span>
                  <input type="number" value={form.salePrice} onChange={(e) => setField("salePrice", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <span>目标用户</span>
                <input value={form.targetAudience ?? ""} onChange={(e) => setField("targetAudience", e.target.value)} />
              </div>
              <div className="field">
                <span>使用场景</span>
                <input value={form.usageScenario ?? ""} onChange={(e) => setField("usageScenario", e.target.value)} />
              </div>
              <div className="export-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAddProduct}
                  disabled={busy || !form.name || !form.category || !form.description}
                >
                  {busy ? "保存中…" : "保存商品"}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowProductForm(false)} disabled={busy}>
                  取消
                </button>
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState text="还没有商品，点右上角「新建商品」添加。" icon="📦" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th>名称</th>
                    <th>类目</th>
                    <th>成本</th>
                    <th>售价</th>
                    <th>目标用户</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td className="col-id">{p.id}</td>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>{p.costPrice}</td>
                      <td>{p.salePrice}</td>
                      <td className="muted">{p.targetAudience ?? "—"}</td>
                      <td>
                        <StatusBadge status={p.status} />
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
