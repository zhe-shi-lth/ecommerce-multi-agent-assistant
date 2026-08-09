import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { confirmOperationPlan, exportOperationPlan, getOperationPlan, rejectOperationPlan } from "../api/operations";
import type { Json, OperationPlan } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import { platformLabel, platformTone } from "../platforms";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

function asStr(v: Json | undefined): string {
  return typeof v === "string" ? v : "";
}
function asArr(v: Json | undefined): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asObj(v: Json | undefined): Record<string, Json> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Json>) : null;
}

const CONFIRM_LABEL: Record<string, string> = {
  PENDING: "待你审核",
  CONFIRMED: "已发布",
  REJECTED: "已驳回",
};

export default function OperationPlanDetail() {
  const { id } = useParams();
  const planId = Number(id);
  const navigate = useNavigate();
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportContent, setExportContent] = useState<string | null>(null);

  useEffect(() => {
    getOperationPlan(planId)
      .then((p) => {
        setPlan(p);
        // 已发布的计划直接带出该平台文案，供复制粘贴
        if ((p.confirmationStatus ?? "PENDING") === "CONFIRMED") {
          exportOperationPlan(planId, p.platform)
            .then((res) => setExportContent(res.content))
            .catch(() => {});
        }
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
    try {
      const updated =
        kind === "confirm"
          ? await confirmOperationPlan(planId)
          : await rejectOperationPlan(planId);
      setPlan(updated);
      // 同意后一并产出该平台文案，免去单独的「导出」按钮
      if (kind === "confirm") {
        const exp = await exportOperationPlan(planId, updated.platform);
        setExportContent(exp.content);
      }
    } catch {
      // 失败由全局错误弹窗（client.ts → errorBus → App 的 AlertModal）统一提示，避免重复弹窗
    } finally {
      setActing(false);
    }
  }

  function copyExport() {
    if (exportContent && navigator.clipboard) {
      navigator.clipboard.writeText(exportContent);
    }
  }

  const product = asObj(plan.productPlanJson);
  const image = asObj(plan.imagePlanJson);
  const title = product ? asStr(product["recommended_title"]) : "";
  const desc = product ? asStr(product["detail_description"]) : "";
  const points = product ? asArr(product["selling_points"]) : [];
  const keywords = product ? asArr(product["seo_keywords"]) : [];
  const listing = product ? asStr(product["listing_suggestion"]) : "";
  const copies = product ? asObj(product["platform_copies"]) : null;
  const platformCopy = copies ? asStr(copies[plan.platform]) : "";
  // 图片创意只保留主图（场景图/营销图为内部素材，不向用户展示）
  const mainImage = image ? asStr(image["main_image_url"]) : "";
  const imgStyle = image ? asStr(image["image_style"]) : "";
  const riskNotes = image ? asArr(image["image_risk_notes"]) : [];

  return (
    <section>
      <PageHeader
        title={`运营计划 #${plan.id}`}
        subtitle={`Trace ${plan.traceId}`}
        icon={<Icon name="plans" />}
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/operation-plans")}>
            <Icon name="logout" /> 返回列表
          </button>
        }
      />
      <div className="meta">
        <span>状态: <StatusBadge status={plan.status} /></span>
        <span>确认状态: {CONFIRM_LABEL[confirmationStatus] ?? confirmationStatus}</span>
        <span>平台: <span className={`badge badge-${platformTone(plan.platform)}`}>{platformLabel(plan.platform)}</span></span>
        <span>需人工审核: {plan.manualReviewRequired ? "是" : "否"}</span>
      </div>

      <div className="card">
        <div className="export-actions">
          {pending ? (
            <>
              <button className="btn btn-primary" onClick={() => handleDecision("confirm")} disabled={acting}>
                {acting ? "处理中…" : "同意并发布"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleDecision("reject")} disabled={acting}>
                {acting ? "处理中…" : "驳回计划"}
              </button>
              <span className="muted">同意后将由库存审核（需当前库存 &gt; 安全阈值），通过才发布商品</span>
            </>
          ) : (
            <p className="muted">
              已{confirmationStatus === "CONFIRMED" ? "确认并发布" : "驳回"}
              {plan.confirmedAt ? `（${plan.confirmedAt}）` : ""}
              {plan.auditMessage ? ` — ${plan.auditMessage}` : ""}
            </p>
          )}
        </div>

        {exportContent && (
          <div className="export-result">
            <div className="export-result-head">
              <span>已生成{platformLabel(plan.platform)}文案，可复制粘贴到对应平台：</span>
              <div className="export-result-actions">
                <button className="btn btn-secondary btn-sm" onClick={copyExport}>
                  复制
                </button>
              </div>
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

      <div className="card">
        <div className="card-header">
          <h3>商品规划</h3>
        </div>
        <div className="detail">
          {title && <div className="detail-title">{title}</div>}
          {desc && <p className="detail-desc">{desc}</p>}
          {points.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">卖点</div>
              <ul className="detail-points">
                {points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {keywords.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">SEO 关键词</div>
              <div className="detail-tags">
                {keywords.map((k, i) => (
                  <span className="tag" key={i}>{k}</span>
                ))}
              </div>
            </div>
          )}
          {platformCopy && (
            <div className="detail-section">
              <div className="detail-label">{platformLabel(plan.platform)} 平台文案</div>
              <div className="detail-copy">{platformCopy}</div>
            </div>
          )}
          {listing && (
            <div className="detail-section">
              <div className="detail-label">上架建议</div>
              <p className="detail-note">{listing}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>图片创意</h3>
        </div>
        <div className="detail">
          {mainImage ? (
            <img className="detail-hero" src={mainImage} alt="商品主图" />
          ) : (
            <div className="detail-img-empty">（未生成主图）</div>
          )}
          {imgStyle && (
            <div className="detail-section">
              <div className="detail-label">图片风格</div>
              <p className="detail-note">{imgStyle}</p>
            </div>
          )}
          {riskNotes.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">图片风险提示</div>
              <ul className="detail-points">
                {riskNotes.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
