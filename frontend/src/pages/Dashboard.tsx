import { useEffect, useMemo, useState } from "react";
import { listDailySales } from "../api/operations";
import { getInventories } from "../api/inventories";
import type { DailySales, Inventory } from "../api/types";
import LineChart from "../components/LineChart";

export default function Dashboard() {
  const [sales, setSales] = useState<DailySales[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listDailySales(), getInventories()])
      .then(([s, inv]) => {
        setSales(s);
        setInventories(inv);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // 按日聚合总营业额
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

  if (loading) return <p className="muted">加载中…</p>;
  if (error) return <p className="error">加载失败：{error}</p>;

  return (
    <section>
      <h2>销售监控</h2>

      <h3>日营业额（近 14 天）</h3>
      <LineChart data={revenueSeries} />

      <h3>日销量（件）</h3>
      <LineChart data={unitsSeries} />

      <h3>库存水位</h3>
      <table>
        <thead>
          <tr>
            <th>商品ID</th>
            <th>当前库存</th>
            <th>安全库存</th>
            <th>水位</th>
          </tr>
        </thead>
        <tbody>
          {inventories.map((inv) => {
            const ratio = inv.safeStockThreshold > 0
              ? Math.min(inv.currentStock / (inv.safeStockThreshold * 2), 1)
              : 1;
            return (
              <tr key={inv.id}>
                <td>{inv.productId}</td>
                <td>{inv.currentStock}</td>
                <td>{inv.safeStockThreshold}</td>
                <td>
                  <div className="stock-bar">
                    <div
                      className="stock-fill"
                      style={{
                        width: `${ratio * 100}%`,
                        background: inv.inventoryStatus === "RISK" ? "#ef4444" : "#22c55e",
                      }}
                    />
                  </div>
                  <span className="muted">{inv.inventoryStatus}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
