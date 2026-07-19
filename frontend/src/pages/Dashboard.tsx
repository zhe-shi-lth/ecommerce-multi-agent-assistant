import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOperationPlans, listDailySales } from "../api/operations";
import { getInventories } from "../api/inventories";
import { getProducts } from "../api/products";
import { getInventoryWarnings } from "../api/line2";
import type { DailySales, Inventory, InventoryWarning, OperationPlan, Product } from "../api/types";
import { PLATFORMS, platformLabel, platformMatches } from "../platforms";
import LineChart from "../components/LineChart";
import PageHeader from "../components/PageHeader";

type Metric = "revenue" | "units";

// 把日销明细按日期聚合为折线图数据；metric 决定取营业额还是销量。
function buildSeries(rows: DailySales[], metric: Metric) {
  const byDate = new Map<string, number>();
  for (const s of rows) {
    const v = metric === "revenue" ? Number(s.revenue) : Number(s.units);
    byDate.set(s.saleDate, (byDate.get(s.saleDate) ?? 0) + v);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [sales, setSales] = useState<DailySales[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [plans, setPlans] = useState<OperationPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warnings, setWarnings] = useState<InventoryWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 销售趋势板块：下拉切换 营业额 / 销量
  const [trendMetric, setTrendMetric] = useState<Metric>("revenue");
  // 单品分析板块：双下拉（商品 + 指标）
  const [singleProductId, setSingleProductId] = useState<string>("");
  const [singleMetric, setSingleMetric] = useState<Metric>("revenue");
  // 平台筛选：影响大盘 KPI、销售趋势、单品分析（库存类看板为商品级、保持全平台）
  const [platform, setPlatform] = useState<string>("ALL");

  useEffect(() => {
    Promise.all([
      listDailySales(),
      getInventories(),
      getOperationPlans(),
      getProducts(),
      getInventoryWarnings(),
    ])
      .then(([s, inv, ps, ps2, w]) => {
        setSales(s);
        setInventories(inv);
        setPlans(ps);
        setProducts(ps2);
        setWarnings(w);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  function productName(id: number): string {
    const p = products.find((x) => x.id === id);
    return p ? p.name : `#${id}`;
  }

  const pendingReview = plans.filter((p) => p.confirmationStatus === "PENDING");
  const lowStock = inventories.filter((i) => i.inventoryStatus === "RISK");

  // 按平台过滤后的日销（供大盘/趋势/单品联动；库存看板不依赖它）
  const platformSales = useMemo(
    () => sales.filter((s) => platformMatches(s.platform, platform)),
    [sales, platform]
  );

  const totalRevenue = useMemo(
    () => platformSales.reduce((a, s) => a + Number(s.revenue), 0),
    [platformSales]
  );
  const totalUnits = useMemo(
    () => platformSales.reduce((a, s) => a + Number(s.units), 0),
    [platformSales]
  );

  const trendSeries = useMemo(() => buildSeries(platformSales, trendMetric), [platformSales, trendMetric]);
  const singleRows = useMemo(
    () => (singleProductId ? platformSales.filter((s) => s.productId === Number(singleProductId)) : []),
    [platformSales, singleProductId]
  );
  const singleSeries = useMemo(
    () => buildSeries(singleRows, singleMetric),
    [singleRows, singleMetric]
  );

  if (loading)
    return (
      <div className="loading">
        <span className="spinner" />
        加载中…
      </div>
    );
  if (error) return <div className="notice notice-error">加载失败：{error}</div>;

  return (
    <section>
      <PageHeader title="销售监控" subtitle="数据大盘、单品趋势与库存预警一览。" />

      <div className="filter-bar" style={{ marginTop: 4 }}>
        <div className="filter-item">
          <label className="filter-label">平台</label>
          <select
            className="header-select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="ALL">全部平台</option>
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {platform !== "ALL" && (
          <span className="muted" style={{ alignSelf: "flex-end" }}>
            已按「{platformLabel(platform)}」筛选销售额与趋势；库存看板为商品级、跨平台
          </span>
        )}
      </div>

      <h2 className="board-title">数据大盘</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">待你审批的计划</div>
          <div className={`stat-value ${pendingReview.length > 0 ? "accent" : ""}`}>{pendingReview.length}</div>
          <div className="stat-hint">点击查看运营计划</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">低库存商品</div>
          <div className={`stat-value ${lowStock.length > 0 ? "warn" : ""}`}>{lowStock.length}</div>
          <div className="stat-hint">点击查看库存</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">在册商品库存项</div>
          <div className="stat-value">{inventories.length}</div>
          <div className="stat-hint">持续监控水位</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">累计营业额</div>
          <div className="stat-value">{Math.round(totalRevenue).toLocaleString()}</div>
          <div className="stat-hint">{platform === "ALL" ? "全部商品合计" : "当前平台合计"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">累计销量</div>
          <div className="stat-value">{totalUnits.toLocaleString()}</div>
          <div className="stat-hint">{platform === "ALL" ? "全部商品合计" : "当前平台合计"}</div>
        </div>
      </div>

      <div className="export-actions">
        <button className="btn btn-secondary" onClick={() => navigate("/operation-plans")}>
          待审批计划 {pendingReview.length} 个 →
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/inventories")}>
          低库存 {lowStock.length} 个 →
        </button>
      </div>

      {/* 销售趋势：日营业额 / 日销量 合并为一个板块，下拉切换 */}
      <div className="card">
        <div className="card-header">
          <h3>销售趋势</h3>
          <select
            className="header-select"
            value={trendMetric}
            onChange={(e) => setTrendMetric(e.target.value as Metric)}
          >
            <option value="revenue">营业额</option>
            <option value="units">销量</option>
          </select>
        </div>
        <LineChart data={trendSeries} />
      </div>

      {/* 单品分析：双下拉（商品 + 指标） */}
      <div className="card">
        <div className="card-header">
          <h3>单品分析</h3>
          <div className="header-selects">
            <select
              className="header-select"
              value={singleProductId}
              onChange={(e) => setSingleProductId(e.target.value)}
            >
              <option value="">选择商品</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.name}
                </option>
              ))}
            </select>
            <select
              className="header-select"
              value={singleMetric}
              onChange={(e) => setSingleMetric(e.target.value as Metric)}
            >
              <option value="revenue">营业额</option>
              <option value="units">销量</option>
            </select>
          </div>
        </div>
        {singleProductId ? (
          <LineChart data={singleSeries} />
        ) : (
          <p className="muted">请选择商品，查看其单品销售趋势。</p>
        )}
      </div>

      {/* 警告板块 */}
      <div className="card">
        <div className="card-header">
          <h3>库存预警</h3>
        </div>
        {warnings.length > 0 ? (
          <div className="notice notice-warn">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>库存预警（线2 · 可售天数 &lt; 5 天）</div>
            {warnings.map((w) => (
              <div key={w.productId} style={{ marginBottom: 6 }}>
                <strong>{w.productName}</strong>
                {w.sellableDays != null && <span> · 可售约 {w.sellableDays} 天</span>}
                {w.activeEvents.length > 0 && <span> · 事件：{w.activeEvents.join("、")}</span>}
                <div className="muted" style={{ marginTop: 2 }}>{w.warnings.join("；")}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">暂无库存预警 🎉</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>库存水位</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th>当前库存</th>
                <th>安全库存</th>
                <th>水位</th>
              </tr>
            </thead>
            <tbody>
              {inventories.map((inv) => {
                const ratio =
                  inv.safeStockThreshold > 0
                    ? Math.min(inv.currentStock / (inv.safeStockThreshold * 2), 1)
                    : 1;
                const fillClass =
                  inv.inventoryStatus === "RISK"
                    ? "bad"
                    : inv.inventoryStatus === "LOW"
                    ? "warn"
                    : "ok";
                return (
                  <tr key={inv.id}>
                    <td>{productName(inv.productId)}</td>
                    <td>{inv.currentStock}</td>
                    <td>{inv.safeStockThreshold}</td>
                    <td>
                      <span className="stock-bar">
                        <span className={`stock-fill ${fillClass}`} style={{ width: `${ratio * 100}%` }} />
                      </span>
                      <span className="muted">{inv.inventoryStatus}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
