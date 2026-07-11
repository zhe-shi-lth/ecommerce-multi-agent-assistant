import { useEffect, useState } from "react";
import { getInventories } from "../api/inventories";
import type { Inventory } from "../api/types";
import StatusBadge from "../components/StatusBadge";

export default function Inventories() {
  const [rows, setRows] = useState<Inventory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventories()
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h2>库存</h2>
      {loading && <p className="muted">加载中…</p>}
      {error && <p className="error">加载失败：{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
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
                <td>{i.id}</td>
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
      )}
    </section>
  );
}
