import { useEffect, useState } from "react";
import { getOrders } from "../api/orders";
import type { Order } from "../api/types";
import StatusBadge from "../components/StatusBadge";

export default function Orders() {
  const [rows, setRows] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders()
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h2>订单</h2>
      {loading && <p className="muted">加载中…</p>}
      {error && <p className="error">加载失败：{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>商品</th>
              <th>数量</th>
              <th>状态</th>
              <th>已付款</th>
              <th>地址完整</th>
              <th>建议履约</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.productId}</td>
                <td>{o.quantity}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td>{o.paid ? "是" : "否"}</td>
                <td>{o.addressComplete ? "是" : "否"}</td>
                <td className="muted">{o.fulfillmentSuggestionStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
