import { useEffect, useState } from "react";
import { getOrders } from "../api/orders";
import type { Order } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

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
      <PageHeader title="订单" subtitle="订单数据查看，是线二履约风控的数据底座。" />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && <div className="notice notice-error">加载失败：{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <EmptyState text="暂无订单数据。" icon="🧾" />
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-id">ID</th>
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
                  <td className="col-id">{o.id}</td>
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
        </div>
      )}
    </section>
  );
}
