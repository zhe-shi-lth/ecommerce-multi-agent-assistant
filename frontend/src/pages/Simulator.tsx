import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { simulatePull, type SimulationResult } from "../api/simulation";
import { getProducts } from "../api/products";
import type { Product } from "../api/types";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

const PLATFORMS = [
  { key: "taobao", label: "淘宝" },
  { key: "douyin", label: "抖音" },
  { key: "xiaohongshu", label: "小红书" },
];

export default function Simulator() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);

  const [platform, setPlatform] = useState("taobao");
  const [selected, setSelected] = useState<number[]>([]);
  const [days, setDays] = useState(14);
  const [maxOrdersPerDay, setMaxOrdersPerDay] = useState(5);
  const [maxQty, setMaxQty] = useState(3);
  // 短期模式：单笔购买数量（用户自行设定）
  const [quickQty, setQuickQty] = useState(2);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    getProducts()
      .then((ps) => {
        setProducts(ps);
        // 默认勾选所有已发布商品，缩短测试配置：打开页面即可一键跑。
        setSelected(ps.filter((p) => p.status === "PUBLISHED").map((p) => p.id));
      })
      .catch((e) => setError(String(e)));
  }, []);

  // 只有「已发布(PUBLISHED)」的商品才能被模拟拉单；其余（草稿/分析中）不可选。
  const publishedProducts = products.filter((p) => p.status === "PUBLISHED");

  function toggleProduct(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setResult(null);
  }

  async function handleRun() {
    if (selected.length === 0) {
      setError("请至少选择一个商品");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await simulatePull({
        platform,
        productIds: selected,
        days,
        maxOrdersPerDay,
        maxQty,
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // 短期快速测试：用「当前勾选」的已发布商品 + 用户设定的购买数量，仅当天、少量单数，一键出数。
  async function handleQuick() {
    if (selected.length === 0) {
      setError("请先勾选至少一个已发布商品");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await simulatePull({
        platform,
        productIds: selected,
        days: 1,
        maxOrdersPerDay: 3,
        maxQty: quickQty,
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="平台模拟"
        subtitle="本地模拟从电商平台 API 拉取订单（不调用真实平台）。生成的订单会联动扣减库存、写入日销，一次性灌满订单 / 库存 / 销售监控三个 tab。"
        icon={<Icon name="simulator" />}
      />
      {error && <div className="notice notice-error">出错：{error}</div>}

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>目标平台（本次拉取的订单将标记为该平台）</h3>
        <div className="check-list">
          {PLATFORMS.map((p) => (
            <label key={p.key} className={`check-item ${platform === p.key ? "checked" : ""}`}>
              <input type="radio" name="platform" checked={platform === p.key} onChange={() => setPlatform(p.key)} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>选择已发布商品（勾选后可用于下方两种模拟）</h3>
        {publishedProducts.length === 0 ? (
          <div className="notice notice-warn" style={{ justifyContent: "flex-start" }}>
            <span>
              还没有已发布的商品。请先通过「新品上架」完成上架（发布），或在「商品」页把商品标记为已发布，再来模拟拉单。
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/new-listing")}>
              去新品上架
            </button>
          </div>
        ) : (
          <div className="check-list">
            {publishedProducts.map((p) => (
              <label key={p.id} className={`check-item ${selected.includes(p.id) ? "checked" : ""}`}>
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                <span>
                  {p.id} {p.name}
                </span>
                <span className="ci-meta">· {p.category}</span>
              </label>
            ))}
          </div>
        )}
        {publishedProducts.length > 0 && (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            已勾选 {selected.length} / {publishedProducts.length} 个已发布商品
          </p>
        )}
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>⚡ 快速模拟（短期·当天）</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          为<strong>上方勾选的已发布商品</strong>生成「当天少量」订单，立即灌满订单 / 库存 / 销售监控三个 tab，无需配置复填。适合快速验证链路。
        </p>
        <div className="listing-form" style={{ marginTop: 8, flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <span>单笔购买数量（可自己设定）</span>
            <input type="number" value={quickQty} min={1} max={20} onChange={(e) => setQuickQty(Number(e.target.value) || 1)} />
          </div>
        </div>
        <div className="export-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleQuick} disabled={busy || selected.length === 0}>
            {busy ? "生成中…" : "⚡ 一键快速模拟（当天）"}
          </button>
          {selected.length === 0 && <span className="muted">请先在上一个卡片勾选已发布商品</span>}
        </div>
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>长期模拟（回填 N 天）</h3>
        <div className="listing-form" style={{ marginTop: 8, flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <span>回填天数（含今天）</span>
            <input type="number" value={days} min={1} max={90} onChange={(e) => setDays(Number(e.target.value) || 1)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <span>每日每商品最大单数</span>
            <input
              type="number"
              value={maxOrdersPerDay}
              min={1}
              max={50}
              onChange={(e) => setMaxOrdersPerDay(Number(e.target.value) || 1)}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <span>单笔最大数量</span>
            <input type="number" value={maxQty} min={1} max={20} onChange={(e) => setMaxQty(Number(e.target.value) || 1)} />
          </div>
        </div>

        <div className="export-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleRun} disabled={busy || selected.length === 0}>
            {busy ? "模拟拉取中…" : "模拟拉取平台订单"}
          </button>
          <span className="muted">
            将生成约 {selected.length * days * Math.max(1, Math.round(maxOrdersPerDay / 2))} 单
          </span>
        </div>
      </div>

      {result && (
        <div className="card listing-review">
          <h3 style={{ marginTop: 0 }}>拉取完成 ✅</h3>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">新建订单</div>
              <div className="stat-value accent">{result.ordersCreated}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">更新库存项</div>
              <div className="stat-value">{result.inventoriesUpdated}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">写入日销记录</div>
              <div className="stat-value">{result.dailySalesUpserted}</div>
            </div>
          </div>
          <div className="export-actions">
            <button className="btn btn-secondary" onClick={() => navigate("/orders")}>
              查看订单 tab →
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/inventories")}>
              查看库存 tab →
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
              查看销售监控 →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
