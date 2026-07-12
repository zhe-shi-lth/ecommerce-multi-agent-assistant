import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  finalizeListing,
  generateImagePlan,
  generateProductPlan,
  type NewProductIdea,
} from "../api/line1";
import type { Json } from "../api/types";
import JsonView from "../components/JsonView";

type Step = 0 | 1 | 2 | 3;

function field(obj: Json | null | undefined, key: string): Json | undefined {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj[key];
  return undefined;
}
function asString(v: Json | undefined): string {
  return typeof v === "string" ? v : "";
}
function asList(v: Json | undefined): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function asMap(v: Json | undefined): Record<string, Json> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, Json>;
  return {};
}

export default function NewListing() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);

  const [idea, setIdea] = useState<NewProductIdea>({
    name: "",
    category: "",
    description: "",
    targetAudience: "",
    usageScenario: "",
  });

  const [productPlan, setProductPlan] = useState<Json | null>(null);
  const [imagePlan, setImagePlan] = useState<Json | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: keyof NewProductIdea, value: string) {
    setIdea((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerateCopy() {
    setBusy(true);
    setError(null);
    try {
      const plan = await generateProductPlan(idea);
      setProductPlan(plan);
      setStep(1);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateImage() {
    if (!productPlan) return;
    setBusy(true);
    setError(null);
    try {
      const img = await generateImagePlan(idea, productPlan);
      setImagePlan(img);
      setStep(2);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    if (!productPlan || !imagePlan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await finalizeListing(idea, productPlan, imagePlan);
      if (!res.ok || res.operationPlanId == null) {
        setError("上架落库失败（请确认 Java 服务已启动）：" + JSON.stringify(res));
        return;
      }
      setStep(3);
      setTimeout(() => navigate(`/operation-plans/${res.operationPlanId}`), 600);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const platformCopies = productPlan ? asMap(field(productPlan, "platform_copies")) : {};

  return (
    <section>
      <h2>新品上架（线1流水线）</h2>
      <p className="muted">
        第一步：输入你的想法 → 文案 Agent 生成 → 你审批 → 图片 Agent 生成 → 你审批 → 完成上架。
      </p>

      <ol className="step-bar">
        <li className={step >= 0 ? "active" : ""}>1 输入想法</li>
        <li className={step >= 1 ? "active" : ""}>2 文案审批</li>
        <li className={step >= 2 ? "active" : ""}>3 图片审批</li>
        <li className={step >= 3 ? "active" : ""}>4 完成上架</li>
      </ol>

      {error && <p className="error">出错：{error}</p>}

      {/* Step 0: 自由输入 */}
      {step === 0 && (
        <div className="listing-form">
          <label>
            商品名称 *
            <input value={idea.name} onChange={(e) => setField("name", e.target.value)} placeholder="如：便携保温杯" />
          </label>
          <label>
            类目 *
            <input value={idea.category} onChange={(e) => setField("category", e.target.value)} placeholder="如：家居/水杯" />
          </label>
          <label>
            功能/卖点描述 *
            <textarea
              rows={4}
              value={idea.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="描述你想卖的东西、它的功能、材质、适用人群等"
            />
          </label>
          <label>
            目标用户（可选）
            <input value={idea.targetAudience ?? ""} onChange={(e) => setField("targetAudience", e.target.value)} placeholder="如：上班族、学生" />
          </label>
          <label>
            使用场景（可选）
            <input value={idea.usageScenario ?? ""} onChange={(e) => setField("usageScenario", e.target.value)} placeholder="如：通勤、办公室、户外" />
          </label>
          <button
            onClick={handleGenerateCopy}
            disabled={busy || !idea.name || !idea.category || !idea.description}
          >
            {busy ? "生成中…" : "生成商品文案"}
          </button>
        </div>
      )}

      {/* Step 1: 文案审批 */}
      {step === 1 && productPlan && (
        <div className="listing-review">
          <h3>商品文案（待你审批）</h3>
          <div className="review-highlight">
            <p><b>建议标题：</b>{asString(field(productPlan, "recommended_title"))}</p>
            <p><b>详情：</b>{asString(field(productPlan, "detail_description"))}</p>
            <p><b>卖点：</b>{asList(field(productPlan, "selling_points")).join("、")}</p>
            <p><b>SEO 词：</b>{asList(field(productPlan, "seo_keywords")).join("、")}</p>
            {Object.keys(platformCopies).length > 0 && (
              <div>
                <b>各平台文案：</b>
                {Object.entries(platformCopies).map(([k, v]) => (
                  <p key={k} className="muted">· {k}：{asString(v)}</p>
                ))}
              </div>
            )}
          </div>
          <details>
            <summary>查看完整 JSON</summary>
            <JsonView data={productPlan} />
          </details>
          <div className="confirm-actions">
            <button onClick={handleGenerateImage} disabled={busy}>
              {busy ? "生成中…" : "通过，生成图片创意"}
            </button>
            <button className="secondary" onClick={() => setStep(0)} disabled={busy}>
              驳回，重新输入
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 图片审批 */}
      {step === 2 && imagePlan && (
        <div className="listing-review">
          <h3>图片创意（待你审批）</h3>
          <div className="review-highlight">
            <p><b>主图提示词：</b>{asString(field(imagePlan, "main_image_prompt"))}</p>
            <p><b>场景图提示词：</b>{asString(field(imagePlan, "scene_image_prompt"))}</p>
            <p><b>营销图提示词：</b>{asString(field(imagePlan, "marketing_image_prompt"))}</p>
            <p><b>图片风格：</b>{asString(field(imagePlan, "image_style"))}</p>
            <p><b>风险提示：</b>{asList(field(imagePlan, "image_risk_notes")).join("；")}</p>
          </div>
          <details>
            <summary>查看完整 JSON（含合规审核）</summary>
            <JsonView data={imagePlan} />
          </details>
          <div className="confirm-actions">
            <button onClick={handleFinalize} disabled={busy}>
              {busy ? "上架中…" : "通过，完成上架"}
            </button>
            <button className="secondary" onClick={() => setStep(1)} disabled={busy}>
              驳回，回到文案
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 完成 */}
      {step === 3 && (
        <div className="listing-review">
          <h3>上架完成 ✅</h3>
          <p>商品与运营计划已落库，正在跳转到计划详情…</p>
        </div>
      )}
    </section>
  );
}
