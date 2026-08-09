import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDataSource, simulatePull, type DataSourceInfo, type SimulationResult } from "../api/simulation";
import { getProducts } from "../api/products";
import { getOperationPlans } from "../api/operations";
import type { Product, OperationPlan } from "../api/types";
import { PLATFORMS, platformLabel } from "../platforms";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

export default function Simulator() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<OperationPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // 订单来源由后端部署开关决定；探测失败时按「模拟数据」展示（当前部署的真实状态）。
  const [dataSource, setDataSource] = useState<DataSourceInfo>({ source: "mock", platforms: [] });

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
    Promise.all([getOperationPlans(), getProducts()])
      .then(([ops, ps]) => {
        setProducts(ps);
        // 只模拟「已确认(CONFIRMED)」的运营计划——计划才代表商品已真正在某平台上架。
        const confirmed = ops.filter((o) => o.confirmationStatus === "CONFIRMED");
        setPlans(confirmed);
        // 默认勾选全部已确认计划，打开页面即可一键跑。
        setSelected(confirmed.map((o) => o.id));
      })
      .catch((e) => setError(String(e)));
    getDataSource()
      .then(setDataSource)
      .catch(() => setDataSource({ source: "mock", platforms: [] }));
  }, []);

  const isReal = dataSource.source === "real";

  const productName = (id: number) =>
    products.find((p) => p.id === id)?.name ?? `#${id}`;

  // 已确认计划按平台分组展示
  const grouped = PLATFORMS.map((pf) => ({
    ...pf,
    plans: plans.filter((p) => p.platform === pf.key),
  })).filter((g) => g.plans.length > 0);

  const totalConfirmed = plans.length;

  function togglePlan(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setResult(null);
  }

  async function run(planIds: number[], opts: { days?: number; maxOrdersPerDay?: number; maxQty?: number }) {
    if (planIds.length === 0) {
      setError("请至少选择一个已确认的运营计划");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await simulatePull({ planIds, ...opts });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRun() {
    // 真实来源下只有「最近多少天」有意义，单量参数由平台实际订单决定。
    await run(selected, isReal ? { days } : { days, maxOrdersPerDay, maxQty });
  }

  // 短期快速测试：用「当前勾选」的已确认计划 + 用户设定的购买数量，仅当天、少量单数，一键出数。
  async function handleQuick() {
    await run(selected, { days: 1, maxOrdersPerDay: 3, maxQty: quickQty });
  }

  return (
    <section>
      <PageHeader
        title={isReal ? "平台订单同步" : "平台模拟"}
        subtitle={
          isReal
            ? "从各电商平台拉取真实订单。订单按「已确认(CONFIRMED)的运营计划」归属到对应商品，会联动扣减库存、写入日销，同步刷新订单 / 库存 / 销售监控三个 tab。"
            : "用模拟订单跑通与真实拉单完全相同的链路（不调用真实平台）。订单按「已确认(CONFIRMED)的运营计划」逐单生成——计划才代表商品已真正在某平台上架，会联动扣减库存、写入日销，一次性灌满订单 / 库存 / 销售监控三个 tab。"
        }
        icon={<Icon name="simulator" />}
      />
      {error && <div className="notice notice-error">出错：{error}</div>}

      {isReal ? (
        <div className="notice notice-ok" style={{ justifyContent: "flex-start" }}>
          <span>
            当前订单来源：<strong>真实平台</strong>
            {dataSource.platforms.length > 0
              ? `（已对接：${dataSource.platforms.map(platformLabel).join("、")}）`
              : "（尚未有平台完成对接，请到「设置中心 → 平台对接」填写凭证）"}
          </span>
        </div>
      ) : (
        <div className="notice notice-warn" style={{ justifyContent: "flex-start" }}>
          <span>
            当前订单来源：<strong>模拟数据</strong>。链路与真实拉单一致，
            到「设置中心 → 平台对接」填好凭证并由运维切换订单来源后，本页即变为真实同步，操作方式不变。
          </span>
        </div>
      )}

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>
          {isReal ? "选择要同步的运营计划（只同步已确认的计划）" : "选择已确认的运营计划（勾选后可用于下方两种模拟）"}
        </h3>
        {totalConfirmed === 0 ? (
          <div className="notice notice-warn" style={{ justifyContent: "flex-start" }}>
            <span>
              还没有已确认的运营计划。请先通过「新品上架」完成上架并确认/发布计划，再来这里取单（一个商品可能还没发布，因此不能用商品直接取单）。
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/new-listing")}>
              去新品上架
            </button>
          </div>
        ) : (
          <>
            {grouped.map((g) => (
              <div key={g.key} style={{ marginTop: 12 }}>
                <div className="muted" style={{ marginBottom: 6 }}>{g.label}（{g.plans.length}）</div>
                <div className="check-list">
                  {g.plans.map((p) => (
                    <label key={p.id} className={`check-item ${selected.includes(p.id) ? "checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => togglePlan(p.id)}
                      />
                      <span>
                        {productName(p.productId)}
                      </span>
                      <span className="ci-meta">· 计划 #{p.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              已勾选 {selected.length} / {totalConfirmed} 个已确认计划
            </p>
          </>
        )}
      </div>

      {!isReal && (
      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>⚡ 快速模拟（短期·当天）</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          为<strong>上方勾选的已确认计划</strong>生成「当天少量」订单，立即灌满订单 / 库存 / 销售监控三个 tab，无需配置复填。适合快速验证链路。
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
          {selected.length === 0 && <span className="muted">请先在上一个卡片勾选已确认计划</span>}
        </div>
      </div>
      )}

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>{isReal ? "同步最近订单" : "长期模拟（回填 N 天）"}</h3>
        <div className="listing-form" style={{ marginTop: 8, flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <span>{isReal ? "拉取最近几天的订单（含今天）" : "回填天数（含今天）"}</span>
            <input type="number" value={days} min={1} max={90} onChange={(e) => setDays(Number(e.target.value) || 1)} />
          </div>
          {!isReal && (
            <>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <span>每日每计划最大单数</span>
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
            </>
          )}
        </div>

        <div className="export-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleRun} disabled={busy || selected.length === 0}>
            {busy ? (isReal ? "同步中…" : "模拟拉取中…") : isReal ? "从平台拉取订单" : "模拟拉取平台订单"}
          </button>
          <span className="muted">
            {isReal
              ? "已同步过的订单不会重复入库"
              : `将生成约 ${selected.length * days * Math.max(1, Math.round(maxOrdersPerDay / 2))} 单`}
          </span>
        </div>
      </div>

      {result && (
        <div className="card listing-review">
          <h3 style={{ marginTop: 0 }}>{isReal ? "同步完成 ✅" : "拉取完成 ✅"}</h3>
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
