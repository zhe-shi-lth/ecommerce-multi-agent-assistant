import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getOperationPlans } from "../api/operations";
import type { OperationPlan } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function OperationPlans() {
  const [plans, setPlans] = useState<OperationPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getOperationPlans()
      .then(setPlans)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <PageHeader
        title="运营计划"
        subtitle="所有 Agent 产出计划的总览（线一/线二），点击行查看详情与执行 trace。"
      />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && (
        <div className="notice notice-error">加载失败：{error}（请确认 Java 服务已启动且有数据）</div>
      )}
      {!loading && !error && plans.length === 0 && (
        <EmptyState text="暂无运营计划。可在「新品上架」走一遍流程，或运行 demo 脚本造数。" icon="🗂" />
      )}
      {!loading && !error && plans.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-id">ID</th>
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
                <tr key={p.id} className="row-link" onClick={() => navigate(`/operation-plans/${p.id}`)}>
                  <td className="col-id">
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
        </div>
      )}
    </section>
  );
}
