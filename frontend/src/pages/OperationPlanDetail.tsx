import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getOperationPlan } from "../api/operations";
import { getAgentRunsByPlan } from "../api/agents";
import type { AgentRun, Json, OperationPlan } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import JsonView from "../components/JsonView";

interface PlanBlock {
  title: string;
  data: Record<string, Json> | null;
}

export default function OperationPlanDetail() {
  const { id } = useParams();
  const planId = Number(id);
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOperationPlan(planId), getAgentRunsByPlan(planId)])
      .then(([p, r]) => {
        setPlan(p);
        setRuns(r);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading) return <p className="muted">加载中…</p>;
  if (error) return <p className="error">加载失败：{error}</p>;
  if (!plan) return <p className="muted">未找到计划 {planId}</p>;

  const blocks: PlanBlock[] = [
    { title: "商品规划 (ProductPlan)", data: plan.productPlanJson },
    { title: "图片创意 (ImagePlan)", data: plan.imagePlanJson },
    { title: "库存采购 (InventoryPlan)", data: plan.inventoryPlanJson },
    { title: "订单履约 (FulfillmentPlan)", data: plan.fulfillmentPlanJson },
  ];

  return (
    <section>
      <h2>运营计划 #{plan.id}</h2>
      <div className="meta">
        <span>Trace: <span className="mono">{plan.traceId}</span></span>
        <span>状态: <StatusBadge status={plan.status} /></span>
        <span>需人工审核: {plan.manualReviewRequired ? "是" : "否"}</span>
      </div>

      <h3>总结</h3>
      <p className="summary">{plan.finalSummary}</p>

      <h3>各 Agent 产出</h3>
      <div className="plan-blocks">
        {blocks.map((b) => (
          <div className="plan-block" key={b.title}>
            <h4>{b.title}</h4>
            <JsonView data={b.data as Json | null} />
          </div>
        ))}
      </div>

      <h3>Agent 执行 Trace（{runs.length}）</h3>
      <div className="runs">
        {runs.map((r) => (
          <details className="run" key={r.id}>
            <summary>
              <StatusBadge status={r.status} />
              <span className="agent-name">{r.agentName}</span>
              <span className="muted">
                {r.durationMs !== null ? `${r.durationMs} ms` : "—"}
              </span>
            </summary>
            {r.errorMessage && <p className="error">错误：{r.errorMessage}</p>}
            <div className="run-io">
              <div>
                <h5>输入</h5>
                <JsonView data={r.inputJson as Json | null} />
              </div>
              <div>
                <h5>输出</h5>
                <JsonView data={r.outputJson as Json | null} />
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
