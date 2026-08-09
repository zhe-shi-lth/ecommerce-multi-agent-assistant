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
import { Icon } from "../components/icons";

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
        subtitle="管理品类基础数据与商品目录。商品是上架流程的起点。"
        icon={<Icon name="products" />}
      />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && <div className="notice notice-error">出错：{error}</div>}

      {!loading && !error && (
        <>
          {/* 板块一：品类管理 */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>品类</h3>
              {!showCatForm && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowCatForm(true)}>
                  新建品类
                </button>
              )}
            </div>

            <div className="cat-chips">
              {categories.length === 0 ? (
                <span className="muted">暂无品类，点右上角「新建品类」添加。</span>
              ) : (
                categories.map((c) => (
                  <span className="cat-chip" key={c.id}>
                    {c.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 板块二：商品管理 */}
          <div className="card">
            <div className="card-header">
              <h3>商品</h3>
            {!showProductForm && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowProductForm(true)}>
                新建商品
              </button>
            )}
          </div>

          {rows.length === 0 ? (
              <EmptyState text="还没有商品，点右上角「新建商品」添加。" icon="📦" />
            ) : (
              <div className="entity-grid">
                {rows.map((p) => (
                  <div className="prod-card" key={p.id}>
                    <div className="prod-card-head">
                      <span className="prod-card-title">{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    {p.description && <p className="prod-card-desc">{p.description}</p>}
                    <div className="prod-card-prices">
                      <div className="prod-price">
                        <span className="k">成本价</span>
                        <span className="v">¥{p.costPrice}</span>
                      </div>
                      <div className="prod-price sale">
                        <span className="k">售价</span>
                        <span className="v">¥{p.salePrice}</span>
                      </div>
                      <div className="prod-price">
                        <span className="k">毛利</span>
                        <span className="v">{p.salePrice - p.costPrice}</span>
                      </div>
                    </div>
                    <div className="prod-card-meta">
                      <span>类目：{p.category}</span>
                      {p.targetAudience && <span>目标：{p.targetAudience}</span>}
                      {p.usageScenario && <span className="muted">场景：{p.usageScenario}</span>}
                    </div>
                    <div className="prod-card-actions">
                      {p.status === "PUBLISHED" ? (
                        <span className="ci-meta">已发布</span>
                      ) : (
                        <span className="ci-meta" title="发布需走：新品上架 → 运营计划 → 同意（库存审核）">
                          经运营计划发布
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showCatForm && (
        <div className="modal-overlay" onClick={() => { setShowCatForm(false); setCatName(""); }}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">新建品类</div>
            <div className="modal-body">
              <div className="field" style={{ marginTop: 0 }}>
                <span>品类名称 *</span>
                <input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="如：家居 / 美妆"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setShowCatForm(false); setCatName(""); }}
                disabled={busy}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddCategory}
                disabled={busy || !catName.trim()}
              >
                {busy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProductForm && (
        <div
          className="modal-overlay"
          onClick={() => { setShowProductForm(false); setForm(EMPTY_FORM); }}
        >
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">新建商品</div>
            <div className="modal-body">
              <div className="listing-form" style={{ marginTop: 0 }}>
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
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setShowProductForm(false); setForm(EMPTY_FORM); }}
                disabled={busy}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddProduct}
                disabled={busy || !form.name || !form.category || !form.description}
              >
                {busy ? "保存中…" : "保存商品"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
