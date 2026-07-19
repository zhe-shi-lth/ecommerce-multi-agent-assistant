import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  finalizeListing,
  generateImagePlan,
  generateProductPlan,
} from "../api/line1";
import { getCapabilities, type Capabilities, type CapFeature } from "../api/capabilities";
import { getProducts } from "../api/products";
import type { Json, Product } from "../api/types";
import JsonView from "../components/JsonView";
import PageHeader from "../components/PageHeader";

// 平台定义：三个平台均可勾选（多选）。
const PLATFORMS = [
  { key: "xiaohongshu", label: "小红书", enabled: true },
  { key: "taobao", label: "淘宝", enabled: true },
  { key: "douyin", label: "抖音", enabled: true },
];

type Phase = "select" | "copy" | "upload" | "image" | "done";

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

const STEP_LABELS = ["选商品+平台", "上传商品图+备注", "文案审批", "图片审批", "完成上架"];

export default function NewListing() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("select");

  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<number[]>([]); // 勾选的商品 id
  const [platforms, setPlatforms] = useState<string[]>(["xiaohongshu"]);

  const [index, setIndex] = useState(0); // 当前处理到第几个选中商品
  const [productPlan, setProductPlan] = useState<Json | null>(null);
  const [imagePlan, setImagePlan] = useState<Json | null>(null);
  const [results, setResults] = useState<{ productId: number; operationPlanId: number | null }[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 模型功能可用性（后端按设置/Key 探测）：用于在没填 Key 时拦截大模型功能并提示去设置中心。
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [needKey, setNeedKey] = useState<CapFeature | null>(null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((e) => setError(String(e)));
  }, []);

  // 进入「上传图 / 图片」这类依赖模型能力的步骤时，重新拉一次可用性
  //（用户在设置中心填完 Key 返回后，能立刻解除拦截）。
  useEffect(() => {
    if (phase === "upload" || phase === "image") {
      getCapabilities()
        .then(setCaps)
        .catch(() => setCaps(null));
    }
  }, [phase]);

  const selectedProducts = products.filter((p) => selected.includes(p.id));
  const current = selectedProducts[index];
  const platformCopies = productPlan ? asMap(field(productPlan, "platform_copies")) : {};
  const imgMain = imagePlan ? asString(field(imagePlan, "main_image_url")) : "";

  // 看图写文案：用户上传的商品图（base64 data URL）+ 商家备注，喂给视觉模型写文案。
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refName, setRefName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  function toggleProduct(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function togglePlatform(key: string) {
    if (!PLATFORMS.find((p) => p.key === key)?.enabled) return;
    setPlatforms((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  // 进入某个选中商品的处理流程：先到「上传参考图」步骤。
  // 文案（productPlan）在 upload 步骤由视觉模型看图/备注生成，图片则在 copy 步骤据文案生成。
  function startProduct(i: number) {
    setIndex(i);
    setProductPlan(null);
    setImagePlan(null);
    setRefImage(null);
    setRefName("");
    setNotes("");
    setError(null);
    setPhase("upload");
  }

  // 上传商品图+备注后生成文案（视觉模型看图/备注写文案），进入文案审批步骤。
  async function generateCopy() {
    setNeedKey(null);
    // 传了商品图 → 走视觉大模型（看图写文案），没填 Key 提前拦截提示。
    if (refImage && caps && !caps.vision.available) {
      setNeedKey("vision");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const plan = await generateProductPlan({
        product_id: current.id,
        platforms,
        ...(refImage ? { reference_image: refImage } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setProductPlan(plan);
      setPhase("copy");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // 文案审批通过后，进入图片生成：传了商品图走图生图（照片为底图+文案为修改目标），
  // 没传图走文生图（仅按文案）。
  async function generateFinalImages() {
    if (!productPlan) return;
    setNeedKey(null);
    // 文生图/图生图依赖出图大模型，没填 Key 提前拦截提示。
    if (caps && !caps.image.available) {
      setNeedKey("image");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const img = await generateImagePlan({
        product_id: current.id,
        platforms,
        product_plan: productPlan,
        ...(refImage ? { reference_image: refImage } : {}),
      });
      setImagePlan(img);
      setPhase("image");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function onPickRef(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setRefImage(url);
      setRefName(file.name);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleFinalize() {
    if (!productPlan || !imagePlan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await finalizeListing({
        product_id: current.id,
        platforms,
        product_plan: productPlan,
        image_plan: imagePlan,
      });
      setResults((prev) => [...prev, { productId: current.id, operationPlanId: res.operationPlanId }]);
      if (index + 1 < selectedProducts.length) {
        startProduct(index + 1);
      } else {
        setPhase("done");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    if (!productPlan) return;
    const text = [
      asString(field(productPlan, "recommended_title")),
      ...asList(field(productPlan, "selling_points")),
      asString(field(productPlan, "detail_description")),
      "",
      "【平台文案】",
      ...platforms.map((pk) => `${pk}：${asString(platformCopies[pk])}`),
    ].join("\n");
    navigator.clipboard?.writeText(text);
  }

  // 文案可手动编辑：直接在 productPlan 上更新，后续图片生成/落库均使用修改后的内容
  function updatePlanField(key: string, value: Json) {
    setProductPlan((prev) => {
      if (!prev || typeof prev !== "object" || Array.isArray(prev)) return prev;
      return { ...(prev as Record<string, Json>), [key]: value };
    });
  }
  function updatePlanPlatform(pk: string, value: string) {
    setProductPlan((prev) => {
      if (!prev || typeof prev !== "object" || Array.isArray(prev)) return prev;
      const obj = prev as Record<string, Json>;
      const copies = asMap(field(obj, "platform_copies"));
      return { ...obj, platform_copies: { ...copies, [pk]: value } };
    });
  }

  const stepState = (i: number): "done" | "active" | "todo" => {
    const activeIdx = { select: 0, upload: 1, copy: 2, image: 3, done: 4 }[phase];
    if (i < activeIdx) return "done";
    if (i === activeIdx) return "active";
    return "todo";
  };

  return (
    <section>
      <PageHeader
        title="新品上架"
        subtitle="勾选已有商品 → 上传商品图+备注 → 看图/备注生成文案（可改）→ 据文案出图 → 你审批 → 落库上架。可多选，逐个处理，每步均可返回上一步。"
      />
      {error && <div className="notice notice-error">出错：{error}</div>}

      {needKey && (
        <div className="notice notice-warn">
          <span>
            该功能需要配置模型 API Key：
            {needKey === "vision"
              ? "「设置中心 → 视觉模型（或 LLM）」未填写 API Key，看图写文案无法运行。"
              : "「设置中心 → 视觉模型 / LLM」未填写 DashScope API Key，文生图/图生图无法运行。"}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/settings")}>
            去设置中心填写
          </button>
        </div>
      )}

      <ul className="stepper">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className={stepState(i)}>
            <span className="step-node">{stepState(i) === "done" ? "✓" : i + 1}</span>
            <span className="step-label">{label}</span>
            {i < STEP_LABELS.length - 1 && <span className="step-line" />}
          </li>
        ))}
      </ul>

      {/* Step 0: 勾选商品 + 选平台 */}
      {phase === "select" && (
        <div className="card listing-review">
          <div className="review-highlight" style={{ marginBottom: 16 }}>
            <h4>目标平台（多选）</h4>
            <div className="check-list">
              {PLATFORMS.map((p) => (
                <label key={p.key} className={`check-item ${platforms.includes(p.key) ? "checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={platforms.includes(p.key)}
                    disabled={!p.enabled}
                    onChange={() => togglePlatform(p.key)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <h4 style={{ margin: "0 0 10px" }}>勾选要上架的商品</h4>
          {products.length === 0 ? (
            <p className="muted">还没有商品，请先到「商品」页创建。</p>
          ) : (
            <div className="check-list">
              {products.map((p) => (
                <label key={p.id} className={`check-item ${selected.includes(p.id) ? "checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  <span>
                    {p.id} {p.name}
                  </span>
                  <span className="ci-meta">· {p.category}</span>
                </label>
              ))}
            </div>
          )}

          <div className="export-actions">
            <button
              className="btn btn-primary"
              onClick={() => startProduct(0)}
              disabled={busy || selectedProducts.length === 0 || platforms.length === 0}
            >
              {busy ? "生成中…" : `开始生成（${selectedProducts.length} 个）`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 文案审批 */}
      {phase === "copy" && productPlan && (
        <div className="card listing-review">
          <h3 style={{ marginTop: 0 }}>
            商品文案（待审 · {index + 1}/{selectedProducts.length}：{current.name}）
          </h3>
          <div className="review-highlight">
            <p className="muted" style={{ marginTop: 0 }}>
              文案已生成（看图/备注）。可直接修改下方文案，确认后据此出图；
              如想换图或重新生成文案，可返回上一步。
            </p>
            <div className="field" style={{ marginBottom: 12 }}>
              <span>建议标题</span>
              <input
                value={asString(field(productPlan, "recommended_title"))}
                onChange={(e) => updatePlanField("recommended_title", e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <span>详情描述</span>
              <textarea
                rows={3}
                value={asString(field(productPlan, "detail_description"))}
                onChange={(e) => updatePlanField("detail_description", e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <span>卖点（每行一条）</span>
              <textarea
                rows={3}
                value={asList(field(productPlan, "selling_points")).join("\n")}
                onChange={(e) => updatePlanField("selling_points", e.target.value.split("\n"))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <span>SEO 词（每行一条）</span>
              <textarea
                rows={2}
                value={asList(field(productPlan, "seo_keywords")).join("\n")}
                onChange={(e) => updatePlanField("seo_keywords", e.target.value.split("\n"))}
              />
            </div>
            {platforms.map((pk) => (
              <div className="field" key={pk} style={{ marginBottom: 12 }}>
                <span>{pk} 文案</span>
                <textarea
                  rows={2}
                  value={asString(platformCopies[pk])}
                  onChange={(e) => updatePlanPlatform(pk, e.target.value)}
                />
              </div>
            ))}
          </div>
          <details>
            <summary>查看完整 JSON</summary>
            <JsonView data={productPlan} />
          </details>
          <div className="export-actions">
            <button className="btn btn-primary" onClick={generateFinalImages} disabled={busy}>
              {busy ? "生成中…" : "通过，去生成图片"}
            </button>
            <button className="btn btn-secondary" onClick={() => setPhase("upload")} disabled={busy}>
              返回上一步
            </button>
            <button className="btn btn-secondary" onClick={handleExport} disabled={!productPlan}>
              导出文案
            </button>
            <button className="btn btn-secondary" onClick={() => setPhase("select")} disabled={busy}>
              重新选择商品
            </button>
          </div>
          {caps && !caps.image.available && (
            <p className="ci-meta" style={{ marginTop: 10 }}>
              未检测到出图 API Key，文生图/图生图功能不可用。请先到「设置中心」填写 DashScope Key。
            </p>
          )}
        </div>
      )}

      {/* Step 1: 上传商品图 + 备注（看图写文案） */}
      {phase === "upload" && (
        <div className="card listing-review">
          <h3 style={{ marginTop: 0 }}>
            上传商品图 + 备注（· {index + 1}/{selectedProducts.length}：{current.name}）
          </h3>
          <p className="muted">
            上传商品图后，视觉模型会<strong>看图 + 备注</strong>写出文案；且最终出图会以这张照片为
            <strong>底图</strong>、按你修改后的文案做<strong>图生图</strong>精修。不上传图片则按文案
            <strong>纯文生图</strong>。文案步骤仍可修改。
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <span>商品图（可选）</span>
            <input type="file" accept="image/*" onChange={onPickRef} />
          </div>
          {refImage && (
            <div className="ref-preview">
              <img className="generated-image" src={refImage} alt="商品图预览" />
              <span className="ci-meta">{refName}</span>
            </div>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <span>商家备注（可选，与商品已有描述合并）</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：主打纯棉、宽松家居风、适合夏天；想要日系小清新风格。"
            />
          </div>
          <div className="export-actions">
            <button
              className="btn btn-primary"
              onClick={generateCopy}
              disabled={busy || !refImage}
            >
              {busy ? "生成中…" : "用此图生成文案"}
            </button>
            <button className="btn btn-secondary" onClick={generateCopy} disabled={busy}>
              跳过图片，仅用备注/商品信息生成文案
            </button>
            <button className="btn btn-secondary" onClick={() => setPhase("select")} disabled={busy}>
              返回上一步
            </button>
          </div>
          {refImage && caps && !caps.vision.available && (
            <p className="ci-meta" style={{ marginTop: 10 }}>
              未检测到视觉模型 API Key，看图写文案功能不可用。请先到「设置中心 → 视觉模型」填写。
            </p>
          )}
        </div>
      )}

      {/* Step 2: 图片审批 */}
      {phase === "image" && imagePlan && (
        <div className="card listing-review">
          <h3 style={{ marginTop: 0 }}>
            图片创意（待审 · {index + 1}/{selectedProducts.length}：{current.name}）
          </h3>
          {/* 主图：真实生成图优先，否则占位说明 */}
          <div className="image-preview">
            {imgMain ? (
              <img className="generated-image primary" src={imgMain} alt={`${current.name} 主图`} />
            ) : (
              <div className="image-preview-frame">
                <div className="image-preview-style">{asString(field(imagePlan, "image_style"))}</div>
                <div className="image-preview-name">{current.name}</div>
                <div className="image-preview-note">未生成真实图（检查 DASHSCOPE_API_KEY / IMAGE_GEN_ENABLED）</div>
              </div>
            )}
          </div>
          <div className="prompt-cards">
            <div className="prompt-card">
              <span className="prompt-card-label">主图提示词（本图即据此文案生成）</span>
              <p>{asString(field(imagePlan, "main_image_prompt"))}</p>
              {imgMain ? (
                <img className="generated-image" src={imgMain} alt="主图" />
              ) : (
                <span className="ci-meta">（图未生成）</span>
              )}
            </div>
          </div>
          <div className="review-highlight">
            <div className="review-grid">
              <div className="review-item">
                <div className="k">图片风格</div>
                <div className="v">{asString(field(imagePlan, "image_style"))}</div>
              </div>
              <div className="review-item">
                <div className="k">风险提示</div>
                <div className="v">{asList(field(imagePlan, "image_risk_notes")).join("；")}</div>
              </div>
            </div>
          </div>
          <details>
            <summary>查看完整 JSON（含合规审核）</summary>
            <JsonView data={imagePlan} />
          </details>
          <div className="export-actions">
            <button className="btn btn-primary" onClick={handleFinalize} disabled={busy}>
              {busy ? "上架中…" : "通过，完成上架（落库）"}
            </button>
            <button className="btn btn-secondary" onClick={() => setPhase("copy")} disabled={busy}>
              返回上一步（改文案可重出图）
            </button>
            <button className="btn btn-secondary" onClick={handleExport} disabled={!productPlan}>
              导出文案
            </button>
            <span className="muted">发布到小红书 · M3 待接入</span>
          </div>
        </div>
      )}

      {/* Step 4: 完成 */}
      {phase === "done" && (
        <div className="card listing-review">
          <h3 style={{ marginTop: 0 }}>上架完成 ✅</h3>
          <p>已处理 {results.length} 个商品，运营计划已落库：</p>
          <ul className="check-list">
            {results.map((r) => (
              <li key={r.productId} className="check-item">
                <span>#{r.productId} → 计划 {r.operationPlanId ?? "（落库失败）"}</span>
                {r.operationPlanId != null && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/operation-plans/${r.operationPlanId}`)}
                  >
                    查看
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="export-actions">
            <button className="btn btn-primary" onClick={() => navigate("/operation-plans")}>
              去运营计划列表
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
