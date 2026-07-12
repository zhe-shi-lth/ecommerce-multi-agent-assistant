import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { confirmOperationPlan, createFavoriteCopy, exportOperationPlan, getOperationPlan, rejectOperationPlan } from "../api/operations";
import { getAgentRunsByPlan } from "../api/agents";
import type { AgentRun, Json, OperationPlan } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import JsonView from "../components/JsonView";
import PageHeader from "../components/PageHeader";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportContent, setExportContent] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [favSaved, setFavSaved] = useState(false);

  useEffect(() => {
    Promise.all([getOperationPlan(planId), getAgentRunsByPlan(planId)])
      .then(([p, r]) => {
        setPlan(p);
        setRuns(r);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading)
    return (
      <div className="loading">
        <span className="spinner" />
        加载中…
      </div>
    );
  if (error) return <div className="notice notice-error">加载失败：{error}</div>;
  if (!plan) return <div className="notice">未找到计划 {planId}</div>;

  const confirmationStatus = plan.confirmationStatus ?? "PENDING";
  const pending = confirmationStatus === "PENDING";

  async function handleDecision(kind: "confirm" | "reject") {
    setActing(true);
    setActionError(null);
    try {
      const updated =
        kind === "confirm"
          ? await confirmOperationPlan(planId)
          : await rejectOperationPlan(planId);
      setPlan(updated);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setActing(false);
    }
  }

  async function handleExport(platform: string) {
    setExporting(true);
    setExportError(null);
    try {
      const res = await exportOperationPlan(planId, platform);
      setExportContent(res.content);
    } catch (e) {
      setExportError(String(e));
    } finally {
      setExporting(false);
    }
  }

  function copyExport() {
    if (exportContent && navigator.clipboard) {
      navigator.clipboard.writeText(exportContent);
    }
  }

  async function handleFavorite() {
    if (!plan) return;
    try {
      const exp = await exportOperationPlan(planId, "taobao");
      const label =
        (plan.productPlanJson?.["recommended_title"] as string) || `计划 ${plan.id} 文案`;
      await createFavoriteCopy({ label, content: exp.content, sourcePlanId: plan.id });
      setFavSaved(true);
      setTimeout(() => setFavSaved(false), 2000);
    } catch (e) {
      setExportError(String(e));
    }
  }

  const blocks: PlanBlock[] = [
    { title: "商品规划 (ProductPlan)", data: plan.productPlanJson },
    { title: "图片创意 (ImagePlan)", data: plan.imagePlanJson },
    { title: "库存采购 (InventoryPlan)", data: plan.inventoryPlanJson },
    { title: "订单履约 (FulfillmentPlan)", data: plan.fulfillmentPlanJson },
  ];

  return (
    <section>
      <PageHeader
        title={`运营计划 #${plan.id}`}
        subtitle={`Trace ${plan.traceId}`}
      />
      <div className="meta">
        <span>状态: <StatusBadge status={plan.status} /></span>
        <span>确认状态: <StatusBadge status={confirmationStatus} /></span>
        <span>需人工审核: {plan.manualReviewRequired ? "是" : "否"}</span>
      </div>

      <div className="card">
        <div className="export-actions">
          {pending ? (
            <>
              <button className="btn btn-primary" onClick={() => handleDecision("confirm")} disabled={acting}>
                {acting ? "处理中…" : "确认计划"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleDecision("reject")} disabled={acting}>
                {acting ? "处理中…" : "驳回计划"}
              </button>
            </>
          ) : (
            <p className="muted">
              已{confirmationStatus === "CONFIRMED" ? "确认" : "驳回"}
              {plan.confirmedAt ? `（${plan.confirmedAt}）` : ""}
            </p>
          )}
          {actionError && <span className="error">操作失败：{actionError}</span>}
        </div>

        <div className="export-actions">
          <span className="muted">导出到：</span>
          <button className="btn btn-secondary" onClick={() => handleExport("taobao")} disabled={exporting}>
            淘宝
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport("douyin")} disabled={exporting}>
            抖音
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport("xiaohongshu")} disabled={exporting}>
            小红书
          </button>
          <button className="btn btn-secondary" onClick={handleFavorite} disabled={exporting}>
            收藏文案
          </button>
          {exporting && <span className="muted">生成中…</span>}
          {favSaved && <span className="muted">已收藏</span>}
          {exportError && <span className="error">导出失败：{exportError}</span>}
        </div>
        {exportContent && (
          <div className="export-result">
            <div className="export-result-head">
              <span>已生成，可复制粘贴：</span>
              <button className="btn btn-secondary btn-sm" onClick={copyExport}>
                复制
              </button>
            </div>
            <textarea readOnly value={exportContent} rows={10} />
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>总结</h3>
        </div>
        <p style={{ margin: 0 }}>{plan.finalSummary}</p>
      </div>

      <h3 style={{ marginBottom: 12 }}>各 Agent 产出</h3>
      <div className="plan-blocks">
        {blocks.map((b) => (
          <div className="plan-block" key={b.title}>
            <h4>{b.title}</h4>
            <JsonView data={b.data as Json | null} />
          </div>
        ))}
      </div>

      <h3 style={{ margin: "20px 0 12px" }}>Agent 执行 Trace（{runs.length}）</h3>
      <div className="runs">
        {runs.map((r) => (
          <details className="run" key={r.id}>
            <summary>
              <StatusBadge status={r.status} />
              <span className="agent-name">{r.agentName}</span>
              <span className="muted">{r.durationMs !== null ? `${r.durationMs} ms` : "—"}</span>
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
