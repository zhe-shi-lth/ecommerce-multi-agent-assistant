import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOperationPlans, listDailySales } from "../api/operations";
import { getInventories } from "../api/inventories";
import { getProducts } from "../api/products";
import { getInventoryWarnings, generateRestockPlans } from "../api/line2";
import { getCapabilities } from "../api/settings";
import { Icon } from "../components/icons";
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
  // 预警板块（可选大模型）：独立加载，不阻塞上方的监控面板。
  const [warnings, setWarnings] = useState<InventoryWarning[]>([]);
  const [warnLoading, setWarnLoading] = useState(true);
  const [warnError, setWarnError] = useState<string | null>(null);
  // 大模型能力探测：决定预警板块显示「智能预警」还是「红线模式」。
  const [monitorAvailable, setMonitorAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [restockMsg, setRestockMsg] = useState<string | null>(null);

  // 销售趋势板块：下拉切换 营业额 / 销量
  const [trendMetric, setTrendMetric] = useState<Metric>("revenue");
  // 单品分析板块：双下拉（商品 + 指标）
  const [singleProductId, setSingleProductId] = useState<string>("");
  const [singleMetric, setSingleMetric] = useState<Metric>("revenue");
  // 平台筛选：影响大盘 KPI、销售趋势、单品分析（库存类看板为商品级、保持全平台）
  const [platform, setPlatform] = useState<string>("ALL");

  // ① 监控面板：仅依赖 Java 业务数据，独立加载且永远秒开。
  useEffect(() => {
    Promise.all([listDailySales(), getInventories(), getOperationPlans(), getProducts()])
      .then(([s, inv, ps, ps2]) => {
        setSales(s);
        setInventories(inv);
        setPlans(ps);
        setProducts(ps2);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // ② 监控大模型能力探测（Python，纯本地判定、瞬间返回，不阻塞面板）。
  useEffect(() => {
    getCapabilities()
      .then((c) => setMonitorAvailable(c?.monitor?.available ?? false))
      .catch(() => setMonitorAvailable(false));
  }, []);

  // ③ 库存预警（Python，独立加载；大模型不可用则走红线降级，仍显示警告）。
  useEffect(() => {
    setWarnLoading(true);
    setWarnError(null);
    getInventoryWarnings()
      .then(setWarnings)
      .catch((e) => setWarnError(String(e)))
      .finally(() => setWarnLoading(false));
  }, []);

  function productName(id: number): string {
    const p = products.find((x) => x.id === id);
    return p ? p.name : `#${id}`;
  }

  async function handleGenerateRestock() {
    setGenerating(true);
    setRestockMsg(null);
    try {
      const res = await generateRestockPlans();
      const { generated, failed } = res;
      if (generated > 0) {
        setRestockMsg(
          `已生成 ${generated} 条补货计划清单，可在「运营计划」中查看并审核。` +
            (failed.length > 0 ? `（${failed.length} 条落库失败）` : "")
        );
      } else if (failed.length > 0) {
        setRestockMsg(`生成失败：${failed.length} 条落库异常，请检查后端与 Java 服务。`);
      } else {
        setRestockMsg("当前预警商品无需补货（已按安全库存覆盖），未生成清单。");
      }
    } catch (e) {
      setRestockMsg(`生成失败：${String(e)}`);
    } finally {
      setGenerating(false);
    }
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
      <PageHeader
        title="销售监控"
        subtitle="数据大盘、单品趋势与库存预警一览。"
        icon={<Icon name="dashboard" />}
      />

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

      {/* 警告板块：可选大模型，独立加载，降级不阻塞面板 */}
      <div className="card">
        <div className="card-header">
          <h3>库存预警</h3>
          <span
            className={`badge ${monitorAvailable ? "badge-info" : "badge-warn"}`}
            title={
              monitorAvailable === null
                ? "正在检测监控大模型能力…"
                : monitorAvailable
                ? "已启用监控大模型：预警含未来事件智能判断"
                : "未启用监控大模型：按可售天数 < 5 天红线预警"
            }
          >
            {monitorAvailable === null
              ? "检测中…"
              : monitorAvailable
              ? "智能预警"
              : "红线模式"}
          </span>
          {warnings.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={handleGenerateRestock}
              disabled={generating}
              title="对当前所有预警商品生成补货计划清单并落库"
            >
              {generating ? "生成中…" : "生成补货清单"}
            </button>
          )}
        </div>
        {warnLoading ? (
          <div className="loading-inline">
            <span className="spinner" />
            预警加载中…
          </div>
        ) : warnError ? (
          <div className="notice notice-error">
            预警加载失败（已降级，面板数据不受影响）：{warnError}
          </div>
        ) : warnings.length > 0 ? (
          <div className="notice notice-warn">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>库存预警（可售天数 &lt; 5 天）</div>
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
        {restockMsg && (
          <div className="notice notice-info" style={{ marginTop: 8 }}>{restockMsg}</div>
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
                const cur = inv.currentStock || 0;
                const safe = inv.safeStockThreshold || 0;
                // 刻度上限取「当前 / 安全库存」的较大者再放 20%，避免水位条过早顶满。
                const scaleMax = Math.max(cur, safe) * 1.2 || 1;
                const fillPct = Math.min((cur / scaleMax) * 100, 100);
                const thresholdPct = safe > 0 ? Math.min((safe / scaleMax) * 100, 100) : 0;
                const fillClass =
                  inv.inventoryStatus === "RISK"
                    ? "bad"
                    : inv.inventoryStatus === "LOW"
                    ? "warn"
                    : "ok";
                return (
                  <tr key={inv.id}>
                    <td>{productName(inv.productId)}</td>
                    <td>{cur}</td>
                    <td>{safe}</td>
                    <td>
                      <span className="stock-bar">
                        <span className={`stock-fill ${fillClass}`} style={{ width: `${fillPct}%` }} />
                        {safe > 0 && (
                          <span
                            className="stock-threshold"
                            style={{ left: `${thresholdPct}%` }}
                            title={`安全库存线：${safe}`}
                          />
                        )}
                      </span>
                      <span className="muted">
                        {inv.inventoryStatus}
                        {safe > 0 && (
                          <>
                            {" · "}
                            {cur >= safe ? "高于安全线" : "低于安全线"}
                          </>
                        )}
                      </span>
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
