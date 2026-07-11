import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOperationPlans } from "../api/operations";
import type { OperationPlan } from "../api/types";
import StatusBadge from "../components/StatusBadge";

export default function OperationPlans() {
  const [plans, setPlans] = useState<OperationPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOperationPlans()
      .then(setPlans)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h2>运营计划</h2>
      {loading && <p className="muted">加载中…</p>}
      {error && <p className="error">加载失败：{error}（请确认 Java 服务已启动且有数据）</p>}
      {!loading && !error && plans.length === 0 && (
        <p className="muted">暂无数据。可运行 python-agent-service/scripts/demo_e2e.py 造数。</p>
      )}
      {!loading && !error && plans.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Trace</th>
              <th>商品</th>
              <th>订单</th>
              <th>状态</th>
              <th>需人工审核</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/operation-plans/${p.id}`}>{p.id}</Link>
                </td>
                <td className="mono">{p.traceId}</td>
                <td>{p.productId}</td>
                <td>{p.orderId}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td>{p.manualReviewRequired ? "是" : "否"}</td>
                <td className="muted">{p.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
