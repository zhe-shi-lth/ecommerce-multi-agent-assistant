import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOperationPlans, listDailySales } from "../api/operations";
import { getInventories } from "../api/inventories";
import type { DailySales, Inventory, OperationPlan } from "../api/types";
import LineChart from "../components/LineChart";
import PageHeader from "../components/PageHeader";

export default function Dashboard() {
  const navigate = useNavigate();
  const [sales, setSales] = useState<DailySales[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [plans, setPlans] = useState<OperationPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listDailySales(), getInventories(), getOperationPlans()])
      .then(([s, inv, ps]) => {
        setSales(s);
        setInventories(inv);
        setPlans(ps);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const pendingReview = plans.filter((p) => p.confirmationStatus === "PENDING");
  const lowStock = inventories.filter((i) => i.inventoryStatus === "RISK");

  const revenueSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of sales) {
      byDate.set(s.saleDate, (byDate.get(s.saleDate) ?? 0) + Number(s.revenue));
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  }, [sales]);

  const unitsSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of sales) {
      byDate.set(s.saleDate, (byDate.get(s.saleDate) ?? 0) + Number(s.units));
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  }, [sales]);

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
      <PageHeader title="销售监控" subtitle="日销趋势、库存水位与轻量待办预警。" />

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
      </div>

      <div className="export-actions">
        <button className="btn btn-secondary" onClick={() => navigate("/operation-plans")}>
          待审批计划 {pendingReview.length} 个 →
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/inventories")}>
          低库存 {lowStock.length} 个 →
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>日营业额（近 14 天）</h3>
        </div>
        <LineChart data={revenueSeries} />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>日销量（件）</h3>
        </div>
        <LineChart data={unitsSeries} />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>库存水位</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-id">商品ID</th>
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
                    <td className="col-id">{inv.productId}</td>
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
