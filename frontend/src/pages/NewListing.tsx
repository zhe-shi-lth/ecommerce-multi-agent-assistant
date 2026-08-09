import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  finalizeListing,
  generateContentBrief,
  generateImagePlan,
  generateProductPlan,
} from "../api/line1";
import { emitAppError } from "../api/errorBus";
import { getCapabilities, type Capabilities, type CapFeature } from "../api/capabilities";
import { generateVideo, getVideoTask } from "../api/video";
import { getProducts } from "../api/products";
import type { Json, Product } from "../api/types";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";
import { usePersistState } from "../usePersistState";

// 平台定义：三个平台均可勾选（多选）。
const PLATFORMS = [
  { key: "xiaohongshu", label: "小红书", enabled: true },
  { key: "taobao", label: "淘宝", enabled: true },
  { key: "douyin", label: "抖音", enabled: true },
];

// 流程（just-in-time：要求在使用它的那一步才问，且可迭代微调）：
//   选商品+平台（+ 可选「整体方向」通用要求）
//   → 上传参考图 + 图片专项要求 → 出图（图生图/文生图）审批（可微调重出）
//   → 文案专项要求 → 文生文（文案）审批（可改）
//   → AI 出视频（独立第5步，可选、可跳过）→ 上架落库。
// 原则：通用要求（整体方向）一次收集、跨图片/视频/文案；图片/文案/视频专项要求分别归位到各自步骤，
// 不在开头一次性盲填。出图先于文案，视频为独立可选步骤。
type Phase = "select" | "upload" | "image" | "copy" | "video" | "done";

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

const STEP_LABELS = ["选商品+平台", "上传参考图+图片要求", "图片审批", "文案审批", "AI 出视频", "完成上架"];

export default function NewListing() {
  const navigate = useNavigate();
  // 以下业务进度/用户输入字段跨 tab 切换持久化（组件卸载不丢失），其余瞬态字段用普通 useState。
  const [phase, setPhase] = usePersistState<Phase>("nl:phase", "select");

  const [products, setProducts] = usePersistState<Product[]>("nl:products", []); // 持久化以避免回切时短暂空白，挂载时仍会重新拉取覆盖
  const [selectedId, setSelectedId] = usePersistState<number | null>("nl:selectedId", null); // 当前上架的商品 id（单商品）
  const [platform, setPlatform] = usePersistState<string>("nl:platform", "xiaohongshu");
  const [productOpen, setProductOpen] = useState(false); // 商品下拉是否展开（瞬态 UI）

  const [productPlan, setProductPlan] = usePersistState<Json | null>("nl:productPlan", null);
  const [imagePlan, setImagePlan] = usePersistState<Json | null>("nl:imagePlan", null);
  const [contentBrief, setContentBrief] = usePersistState<Json | null>("nl:contentBrief", null);
  const [planId, setPlanId] = usePersistState<number | null>("nl:planId", null); // 本次上架的运营计划 id

  const [busy, setBusy] = useState(false); // 瞬态：生成/上架中
  const [exportMsg, setExportMsg] = useState<string | null>(null); // 导出文案反馈（瞬态）

  // 出视频（万相 wan2.7，走 DashScope 原生 API，异步轮询）。
  const [videoBusy, setVideoBusy] = useState(false); // 瞬态
  const [videoUrl, setVideoUrl] = usePersistState<string | null>("nl:videoUrl", null);
  const [videoError, setVideoError] = useState<string | null>(null); // 瞬态：错误提示

  // 图生视频：默认照片来自上一步生成的商品图（进入 video 步时填充），可删除/重新导入。
  const [i2vRequirements, setI2vRequirements] = usePersistState<string>("nl:i2vRequirements", "");
  const [videoPhotos, setVideoPhotos] = usePersistState<string[] | null>("nl:videoPhotos", null); // null=未初始化
  const [videoPhotoSel, setVideoPhotoSel] = usePersistState<string | null>("nl:videoPhotoSel", null);

  // 模型功能可用性（后端按设置/Key 探测）：用于在没填 Key 时拦截大模型功能并提示去设置中心。
  const [caps, setCaps] = useState<Capabilities | null>(null); // 每次挂载按阶段重新探测
  const [needKey, setNeedKey] = useState<CapFeature | null>(null); // 瞬态：拦截提示

  // 参考图（可选）：驱动「出图」。整体方向由第一页 merchantBrief 提供，图片/文案专项要求各自步骤收集。
  const [refImage, setRefImage] = usePersistState<string | null>("nl:refImage", null);
  const [refName, setRefName] = usePersistState<string>("nl:refName", "");
  const [merchantBrief, setMerchantBrief] = usePersistState<string>("nl:merchantBrief", "");
  const [imageRequirements, setImageRequirements] = usePersistState<string>("nl:imageRequirements", "");
  const [txt2imgRequirements, setTxt2imgRequirements] = usePersistState<string>("nl:txt2imgRequirements", "");
  const [videoRequirements, setVideoRequirements] = usePersistState<string>("nl:videoRequirements", "");
  const [copyRequirements, setCopyRequirements] = usePersistState<string>("nl:copyRequirements", "");

  // 图片微调备注：在图片审批步追加，拼进 image_requirements 重新出图（迭代，不回到开头重填）。
  const [imageRefine, setImageRefine] = usePersistState<string>("nl:imageRefine", "");

  // 当前图片由哪条路径生成（图生图 / 文生图），用于微调时选对应要求。
  const [genPath, setGenPath] = usePersistState<"img2img" | "txt2img" | null>("nl:genPath", null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => {});
  }, []);

  // 进入「出图 / 图片审批 / 文案 / 出视频」这类依赖模型能力的步骤时，重新拉一次可用性
  //（用户在设置中心填完 Key 返回后，能立刻解除拦截）。
  useEffect(() => {
    if (phase === "upload" || phase === "image" || phase === "copy" || phase === "video") {
      getCapabilities()
        .then(setCaps)
        .catch(() => setCaps(null));
    }
  }, [phase]);

  // 进入出视频步：把上一步生成的商品主图作为「图生视频」的默认照片（仅一张；用户增删后保留）。
  useEffect(() => {
    if (phase === "video" && videoPhotos === null) {
      const main = imagePlan ? field(imagePlan, "main_image_url") : undefined;
      const defaults = typeof main === "string" && main.length > 0 ? [main] : [];
      setVideoPhotos(defaults);
      setVideoPhotoSel(defaults[0] ?? null);
    }
  }, [phase, videoPhotos, imagePlan]);

  const current = selectedId != null ? products.find((p) => p.id === selectedId) || null : null;
  const platformCopies = productPlan ? asMap(field(productPlan, "platform_copies")) : {};
  const imgMain = imagePlan ? asString(field(imagePlan, "main_image_url")) : "";

  function selectPlatform(key: string) {
    if (!PLATFORMS.find((p) => p.key === key)?.enabled) return;
    setPlatform(key);
  }

  // 进入单个商品的上架流程：先到「上传参考图 + 备注」步骤。
  // 出图（image-plan）由商品信息 + 备注（+ 可选商品图做图生图）生成，与文案解耦。
  // 注意：保留 merchantBrief（整体方向），不随单个商品重置。
  function startOnboarding() {
    if (selectedId == null) return;
    setProductPlan(null);
    setImagePlan(null);
    setContentBrief(null);
    setRefImage(null);
    setRefName("");
    setImageRequirements("");
    setTxt2imgRequirements("");
    setVideoRequirements("");
    setI2vRequirements("");
    setVideoPhotos(null);
    setVideoPhotoSel(null);
    setCopyRequirements("");
    setImageRefine("");
    setGenPath(null);
    setPlanId(null);
    setPhase("upload");
  }

  async function ensureContentBrief() {
    if (!current) return null;
    if (contentBrief) return contentBrief;
    const brief = await generateContentBrief({
      product_id: current.id,
      platforms: [platform],
      ...(merchantBrief.trim() ? { merchant_brief: merchantBrief.trim() } : {}),
    });
    setContentBrief(brief);
    return brief;
  }

  // 上传参考图 + 备注后生成主图。
  // reqs 为「图片专项要求」（图生图/文生图各自独立），extra 为审批步的「微调备注」。
  // 传了商品图走图生图，没传图走文生图。
  async function generateImage(reqs?: string, extra?: string) {
    if (!current) return;
    setNeedKey(null);
    // 文生图/图生图依赖出图大模型，没填 Key 提前拦截提示。
    if (caps && !caps.image.available) {
      setNeedKey("image");
      return;
    }
    setBusy(true);
    try {
      const brief = await ensureContentBrief();
      const merged = [reqs?.trim(), extra?.trim()].filter(Boolean).join("\n");
      const img = await generateImagePlan({
        product_id: current.id,
        platforms: [platform],
        ...(refImage ? { reference_image: refImage } : {}),
        ...(brief ? { content_brief: brief } : {}),
        ...(merged ? { image_requirements: merged } : {}),
      });
      setImagePlan(img);
      setGenPath(refImage ? "img2img" : "txt2img");
      setPhase("image");
    } catch {
      /* error surfaced via global modal */
    } finally {
      setBusy(false);
    }
  }

  // 图片审批步：应用「微调备注」重新出图（迭代），不回到开头重填。
  // 微调基于当前图片所用路径的要求（图生图 / 文生图各自独立）。
  async function regenerateImage() {
    if (!imageRefine.trim() || !current) return;
    const base = genPath === "txt2img" ? txt2imgRequirements : imageRequirements;
    await generateImage(base, imageRefine.trim());
    setImageRefine("");
  }

  // 图片审批通过后，进入文案生成（文生文）：仅按商品信息 + 备注生成平台文案。
  async function generateCopy() {
    if (!imagePlan || !current) return;
    setNeedKey(null);
    // 文生文依赖文本 LLM，没填 Key 提前拦截提示。
    if (caps && !caps.llm.available) {
      setNeedKey("llm");
      return;
    }
    setBusy(true);
    try {
      const brief = await ensureContentBrief();
      const plan = await generateProductPlan({
        product_id: current.id,
        platforms: [platform],
        ...(brief ? { content_brief: brief } : {}),
        ...(copyRequirements.trim() ? { copy_requirements: copyRequirements.trim() } : {}),
      });
      setProductPlan(plan);
      setPhase("copy");
    } catch {
      /* error surfaced via global modal */
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

  // 轮询视频任务直到终态（SUCCEEDED 取 video_url）。DashScope 视频为异步任务，需多次查询。
  async function pollVideo(taskId: string) {
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 15000));
      try {
        const t = await getVideoTask(taskId);
        if (t.status === "SUCCEEDED" && t.video_url) {
          setVideoUrl(t.video_url);
          return;
        }
        if (["FAILED", "CANCELED", "UNKNOWN"].includes(t.status)) {
          setVideoError(`视频生成${t.status}，请检查模型/Key 或源视频后重试`);
          return;
        }
      } catch {
        /* 单次查询异常不中断，继续轮询；全局错误条会提示 */
      }
    }
    setVideoError("视频生成轮询超时（约 5 分钟），可稍后重试或用任务 ID 直接在设置中心查询");
  }

  // 文生视频：用商品文案生成宣传短片（wan2.7-t2v）。
  async function genPromoVideo() {
    if (!productPlan) return;
    if (caps && !caps.video.available) {
      setNeedKey("video");
      emitAppError("视频模型未配置：请先到「设置中心 → 视频模型」填写 API Key，再生成视频。");
      return;
    }
    setNeedKey(null);
    setVideoError(null);
    setVideoUrl(null);
    setVideoBusy(true);
    try {
      const prompt = [
        contentBrief ? `上架策略：${JSON.stringify(contentBrief)}` : "",
        videoRequirements.trim() ? `视频专项要求：${videoRequirements.trim()}` : "",
        asString(field(productPlan, "recommended_title")),
        asString(field(productPlan, "detail_description")),
      ]
        .filter(Boolean)
        .join("；");
      const res = await generateVideo({
        prompt,
        ...(imgMain ? { image_url: imgMain } : {}),
        resolution: "720P",
        duration: 5,
        ratio: "16:9",
      });
      await pollVideo(res.task_id);
    } catch {
      /* 错误经全局弹窗提示 */
    } finally {
      setVideoBusy(false);
    }
  }

  // 图生视频：用一张商品图生成视频（wan2.7-i2v）。
  async function genImageVideo() {
    if (!videoPhotoSel) {
      setVideoError("请先选择或导入一张照片用于图生视频");
      return;
    }
    if (caps && !caps.video.available) {
      setNeedKey("video");
      emitAppError("视频模型未配置：请先到「设置中心 → 视频模型」填写 API Key，再生成视频。");
      return;
    }
    setNeedKey(null);
    setVideoError(null);
    setVideoUrl(null);
    setVideoBusy(true);
    try {
      const prompt = [
        contentBrief ? `上架策略：${JSON.stringify(contentBrief)}` : "",
        i2vRequirements.trim() ? `视频专项要求：${i2vRequirements.trim()}` : "",
        asString(field(productPlan, "recommended_title")),
        asString(field(productPlan, "detail_description")),
      ]
        .filter(Boolean)
        .join("；");
      const res = await generateVideo({
        prompt,
        image_url: videoPhotoSel,
        resolution: "720P",
        duration: 5,
        ratio: "16:9",
      });
      await pollVideo(res.task_id);
    } catch {
      /* 错误经全局弹窗提示 */
    } finally {
      setVideoBusy(false);
    }
  }

  // 图生视频：导入照片（本地文件转 dataURL，可选追加）。
  async function onPickVideoPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setVideoPhotos((prev) => [...(prev ?? []), url]);
      setVideoPhotoSel(url);
    } catch (err) {
      emitAppError(String(err));
    }
  }
  function removeVideoPhoto(url: string) {
    setVideoPhotos((prev) => {
      const next = (prev ?? []).filter((u) => u !== url);
      if (videoPhotoSel === url) setVideoPhotoSel(next[0] ?? null);
      return next;
    });
  }

  // 完成上架：必须已生成视频，否则弹窗提示先生成；「跳过视频」则直接上架。
  function handleComplete() {
    if (!videoUrl) {
      emitAppError("请先生成视频，再完成上架；若暂不生成视频，可点击「跳过视频」直接上架。");
      return;
    }
    handleFinalize();
  }

  async function onPickRef(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setRefImage(url);
      setRefName(file.name);
    } catch (err) {
      emitAppError(String(err));
    }
  }

  async function handleFinalize() {
    if (!productPlan || !imagePlan || !current) return;
    setBusy(true);
    try {
      const res = await finalizeListing({
        product_id: current.id,
        platform,
        content_brief: contentBrief,
        product_plan: productPlan,
        image_plan: imagePlan,
      });
      setPlanId(res.operationPlanId ?? null);
      setPhase("done");
    } catch {
      /* error surfaced via global modal */
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
      ...[platform].map((pk) => `${pk}：${asString(platformCopies[pk])}`),
    ].join("\n");

    // 1) 真实下载 .txt 文件（无论是否安全上下文都可用）
    const safeTitle =
      (asString(field(productPlan, "recommended_title")) || "商品文案")
        .replace(/[\\/:*?"<>|\r\n]+/g, "_")
        .slice(0, 40) || "商品文案";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 2) 剪贴板复制（仅安全上下文可用），作为兜底；失败也不影响下载
    let settled = false;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          if (settled) return;
          settled = true;
          setExportMsg("文案已下载，并复制到剪贴板");
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          setExportMsg("文案已下载（.txt 文件）");
        });
    } else {
      setExportMsg("文案已下载（.txt 文件）");
    }

    // 3 秒后清除反馈
    window.setTimeout(() => setExportMsg(null), 3000);
  }

  // 文案可手动编辑：直接在 productPlan 上更新，后续落库均使用修改后的内容
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
    const activeIdx = { select: 0, upload: 1, image: 2, copy: 3, video: 4, done: 5 }[phase];
    if (i < activeIdx) return "done";
    if (i === activeIdx) return "active";
    return "todo";
  };

  return (
    <section>
      <PageHeader
        title="新品上架"
        subtitle="选择已有商品（单商品逐个上架）→（可选）整体方向 → 上传参考图+图片要求 → 出图（可微调重出）→ 写文案要求+文生文（可改）→ AI 出视频（独立可选步，可跳过）→ 落库上架。要求在使用它的那一步才填，每步均可返回上一步。"
        icon={<Icon name="new" />}
      />
      {needKey && (
        <div className="notice notice-warn">
          <span>
            该功能需要配置模型 API Key：
            {needKey === "image"
              ? "「设置中心 → 出图模型」未填写 API Key，文生图/图生图无法运行。"
              : needKey === "video"
                ? "「设置中心 → 视频模型」未填写 API Key，出视频无法运行。"
                : "「设置中心 → 文本大模型（LLM）」未填写 API Key，文生文无法运行。"}
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

      {/* Step 0: 选平台 + 选商品（上下排列；平台横向，商品下拉） */}
      {phase === "select" && (
        <div className="listing-review select-centered">
          <div className="step-head">
            <h2 className="step-title">选择商品与平台</h2>
            <p className="step-desc">
              选择要上架的商品（单商品逐个上架）与目标平台，必要时补充整体方向（可选）。确认后系统会生成图片与文案。
            </p>
          </div>
          {/* 板块一：目标平台（x 轴横向排布） */}
          <section className="setup-block">
            <h4>目标平台</h4>
            <div className="platform-row">
              {PLATFORMS.map((p) => (
                <label key={p.key} className={`check-item ${platform === p.key ? "checked" : ""}`}>
                  <input
                    type="radio"
                    name="platform"
                    checked={platform === p.key}
                    disabled={!p.enabled}
                    onChange={() => selectPlatform(p.key)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* 板块二：商品（下拉单选） */}
          <section className="setup-block">
            <h4>选择要上架的商品（单个）</h4>
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-secondary dropdown-trigger"
                onClick={() => setProductOpen((o) => !o)}
              >
                {selectedId != null
                  ? (products.find((p) => p.id === selectedId)?.name ?? "选择商品…")
                  : "选择商品…"}
                <span className="caret">▾</span>
              </button>
              {productOpen && (
                <>
                  <div className="dropdown-backdrop" onClick={() => setProductOpen(false)} />
                  <div className="dropdown-menu">
                    {products.length === 0 ? (
                      <p className="muted" style={{ padding: 12 }}>
                        还没有商品，请先到「商品」页创建。
                      </p>
                    ) : (
                      products.map((p) => (
                        <label
                          key={p.id}
                          className={`check-item ${selectedId === p.id ? "checked" : ""}`}
                          onClick={() => setSelectedId(p.id)}
                        >
                          <input type="radio" checked={selectedId === p.id} readOnly />
                          <span>
                            {p.id} {p.name}
                          </span>
                          <span className="ci-meta">· {p.category}</span>
                        </label>
                      ))
                    )}
                    <div className="dropdown-foot">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setProductOpen(false)}
                      >
                        完成
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {selectedId != null && current && (
              <div className="chips">
                <span className="chip">
                  {current.name}
                  <button type="button" onClick={() => setSelectedId(null)} aria-label="移除">
                    ×
                  </button>
                </span>
              </div>
            )}
          </section>

          <section className="setup-block">
            <h4>整体方向 / 通用要求（可选）</h4>
            <div className="field" style={{ marginBottom: 4 }}>
              <span>一句话表达这次上架的整体意图（如风格、场景、调性），留空则按商品默认</span>
              <textarea
                rows={3}
                value={merchantBrief}
                onChange={(e) => setMerchantBrief(e.target.value)}
                placeholder="例如：主打夏季通勤场景，风格自然真实，不要夸张营销感，突出便携和高颜值。"
              />
            </div>
          </section>

          <div className="export-actions">
            <button
              className="btn btn-primary"
              onClick={startOnboarding}
              disabled={busy || selectedId == null || !platform}
            >
              {busy ? "生成中…" : "开始生成"}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: 图片生成（图生图 / 文生图 左右两块，分隔） */}
      {phase === "upload" && current && (
        <div className="listing-review listing-wide">
          <div className="step-head">
            <h2 className="step-title">上传参考图与图片要求</h2>
            <p className="step-desc">
              两条路径二选一：有商品图走图生图精修，无图走纯文生图。填写对应路径的图片要求后生成主图，下一步可审批微调。
            </p>
            <div className="step-meta">当前商品：{current.name}</div>
          </div>

          <div className="listing-panels">
          {/* 板块一：图生图 */}
          <div className="listing-panel panel-left">
            <h4 className="panel-title">① 图生图（以商品图为底图精修）</h4>
            <div className="field" style={{ marginBottom: 12 }}>
              <span>商品图（必填）</span>
              <input type="file" accept="image/*" onChange={onPickRef} />
            </div>
            {refImage && (
              <div className="ref-preview">
                <img className="generated-image" src={refImage} alt="商品图预览" />
                <span className="ci-meta">{refName}</span>
              </div>
            )}
            <div className="field" style={{ marginBottom: 12 }}>
              <span>图片专项要求（只影响图生图）</span>
              <textarea
                rows={3}
                value={imageRequirements}
                onChange={(e) => setImageRequirements(e.target.value)}
                placeholder="例如：白色桌面、自然光、旁边放电脑和帆布包，画面干净，不要人物露脸。"
              />
            </div>
            <div className="export-actions">
              <button
                className="btn btn-primary"
                onClick={() => generateImage(imageRequirements)}
                disabled={busy || !refImage}
              >
                {busy ? "生成中…" : "生成（图生图）"}
              </button>
            </div>
          </div>

          {/* 板块二：文生图 */}
          <div className="listing-panel panel-right">
            <h4 className="panel-title">② 文生图（无参考图，纯按商品信息+要求生成）</h4>
            <div className="field" style={{ marginBottom: 12 }}>
              <span>图片专项要求（只影响文生图）</span>
              <textarea
                rows={3}
                value={txt2imgRequirements}
                onChange={(e) => setTxt2imgRequirements(e.target.value)}
                placeholder="例如：纯白背景电商主图，居中展示商品，柔和打光，极简高级感。"
              />
            </div>
            <div className="export-actions">
              <button
                className="btn btn-primary"
                onClick={() => generateImage(txt2imgRequirements)}
                disabled={busy}
              >
                {busy ? "生成中…" : "生成（文生图）"}
              </button>
            </div>
          </div>
          </div>

          <div className="back-row">
            <button className="btn btn-secondary btn-back-wide" onClick={() => setPhase("select")} disabled={busy}>
              返回上一步
            </button>
          </div>
          {caps && !caps.image.available && (
            <p className="ci-meta" style={{ marginTop: 10 }}>
              未检测到出图 API Key，文生图/图生图功能不可用。请先到「设置中心 → 出图模型」填写。
            </p>
          )}
        </div>
      )}

      {/* Step 2: 图片审批 */}
      {phase === "image" && imagePlan && (
        <div className="listing-review">
          <div className="step-head">
            <h2 className="step-title">图片创意审批</h2>
            <p className="step-desc">
              预览生成的主图、风格与风险提示；可写微调备注重新出图，满意后进入文案环节。
            </p>
            <div className="step-meta">当前商品：{current?.name}</div>
          </div>
          {/* 主图：真实生成图优先，否则占位说明 */}
          <div className="image-preview">
            {imgMain ? (
              <img className="generated-image primary" src={imgMain} alt={`${current?.name} 主图`} />
            ) : (
              <div className="image-preview-frame">
                <div className="image-preview-style">{asString(field(imagePlan, "image_style"))}</div>
                <div className="image-preview-name">{current?.name}</div>
                <div className="image-preview-note">未生成真实图（检查 DASHSCOPE_API_KEY / IMAGE_GEN_ENABLED）</div>
              </div>
            )}
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
          <div className="field" style={{ margin: "12px 0" }}>
            <span>微调备注（看了图再补，应用后重新出图）</span>
            <textarea
              rows={2}
              value={imageRefine}
              onChange={(e) => setImageRefine(e.target.value)}
              placeholder="例如：背景换成户外咖啡馆，色调再暖一点，不要出现文字。"
            />
          </div>
          <div className="export-actions">
            <button className="btn btn-secondary" onClick={regenerateImage} disabled={busy || !imageRefine.trim()}>
              {busy ? "重出中…" : "应用微调并重出"}
            </button>
            <button className="btn btn-primary" onClick={() => setPhase("copy")} disabled={busy}>
              {busy ? "生成中…" : "通过，去写文案（文生文）"}
            </button>
          </div>
          <div className="back-row">
            <button className="btn btn-secondary btn-back-wide" onClick={() => setPhase("upload")} disabled={busy}>
              返回上一步（改图可重出）
            </button>
          </div>
          {caps && !caps.image.available && (
            <p className="ci-meta" style={{ marginTop: 10 }}>
              未检测到出图 API Key，文生图/图生图功能不可用。请先到「设置中心 → 出图模型」填写。
            </p>
          )}
        </div>
      )}

      {/* Step 3: 文案审批（文生文） */}
      {phase === "copy" && current && (
        productPlan ? (
        <div className="listing-review">
          <div className="step-head">
            <h2 className="step-title">商品文案审批</h2>
            <p className="step-desc">
              AI 已生成文案，可直接修改；确认后进入出视频步骤（可跳过）。
            </p>
            <div className="step-meta">当前商品：{current?.name}</div>
          </div>
          <div className="review-highlight">
            <p className="muted" style={{ marginTop: 0 }}>
              文案已生成（文生文）。可直接修改下方文案，确认后据此落库上架；
              如想换图或重新生成，可返回上一步。
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
            {[platform].map((pk) => (
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

          <div className="export-actions">
            <button className="btn btn-primary" onClick={() => setPhase("video")} disabled={busy}>
              {busy ? "生成中…" : "通过，去出视频（可跳过）"}
            </button>
            <button className="btn btn-secondary" onClick={handleExport} disabled={!productPlan}>
              导出文案
            </button>
            {exportMsg && <span className="export-msg">{exportMsg}</span>}
          </div>
          <div className="back-row">
            <button className="btn btn-secondary btn-back-wide" onClick={() => setPhase("image")} disabled={busy}>
              返回上一步（改图可重出）
            </button>
          </div>
        </div>
        ) : (
        <div className="listing-review">
          <div className="step-head">
            <h2 className="step-title">商品文案要求</h2>
            <p className="step-desc">
              先填写文案专项要求，再据此生成商品文案（文生文）；生成后可逐字修改。
            </p>
            <div className="step-meta">当前商品：{current?.name}</div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <span>文案专项要求（只影响文案生成）</span>
            <textarea
              rows={4}
              value={copyRequirements}
              onChange={(e) => setCopyRequirements(e.target.value)}
              placeholder="例如：标题不要太硬广，正文像真实分享，多带小红书标签；突出便携与高颜值。"
            />
          </div>
          <div className="export-actions">
            <button className="btn btn-primary" onClick={generateCopy} disabled={busy}>
              {busy ? "生成中…" : "生成商品文案（文生文）"}
            </button>
          </div>
          <div className="back-row">
            <button className="btn btn-secondary btn-back-wide" onClick={() => setPhase("image")} disabled={busy}>
              返回上一步（改图可重出）
            </button>
          </div>
        </div>
        )
      )}

      {/* Step 5: AI 出视频（独立步骤，可选、可跳过） */}
      {phase === "video" && current && productPlan && (
        <div className="listing-review listing-wide">
          <div className="step-head">
            <h2 className="step-title">AI 出视频（可选）</h2>
            <p className="step-desc">
              两条路径二选一：用文案生成宣传视频，或用商品图生成视频。视频仅本页预览、不落库；也可直接跳过上架。
            </p>
            <div className="step-meta">当前商品：{current?.name}</div>
          </div>

          <div className="listing-panels">
            {/* 板块一：文生视频 */}
            <div className="listing-panel panel-left">
              <h4 className="panel-title">① 文生视频（用商品文案生成）</h4>
              <div className="field" style={{ marginBottom: 12 }}>
                <span>文生视频要求（可选）</span>
                <textarea
                  rows={3}
                  value={videoRequirements}
                  onChange={(e) => setVideoRequirements(e.target.value)}
                  placeholder="例如：5 秒左右，先展示放进包里，再展示打开使用，节奏轻快，适合小红书。"
                />
              </div>
              <div className="export-actions">
                <button className="btn btn-primary" onClick={genPromoVideo} disabled={videoBusy}>
                  {videoBusy ? "生成中…" : "生成（文生视频）"}
                </button>
              </div>
            </div>

            {/* 板块二：图生视频 */}
            <div className="listing-panel panel-right">
              <h4 className="panel-title">② 图生视频（用商品图生成）</h4>
              <div className="field" style={{ marginBottom: 12 }}>
                <span>照片（默认用上一步生成的商品图，可删除后重新导入）</span>
                <div className="photo-grid">
                  {(videoPhotos ?? []).map((u) => (
                    <div
                      key={u}
                      className={`photo-item ${videoPhotoSel === u ? "selected" : ""}`}
                      onClick={() => setVideoPhotoSel(u)}
                    >
                      <img className="photo-thumb" src={u} alt="商品图" />
                      <button
                        type="button"
                        className="photo-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeVideoPhoto(u);
                        }}
                        aria-label="删除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label className="photo-add">
                    <input type="file" accept="image/*" onChange={onPickVideoPhoto} hidden />
                    <span>＋ 导入照片</span>
                  </label>
                </div>
                {(videoPhotos ?? []).length === 0 && (
                  <p className="ci-meta">暂无照片，请导入一张用于图生视频。</p>
                )}
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <span>图生视频要求（可选）</span>
                <textarea
                  rows={3}
                  value={i2vRequirements}
                  onChange={(e) => setI2vRequirements(e.target.value)}
                  placeholder="例如：让商品轻微转动，背景虚化，镜头缓慢推进。"
                />
              </div>
              <div className="export-actions">
                <button
                  className="btn btn-primary"
                  onClick={genImageVideo}
                  disabled={videoBusy || (videoPhotos ?? []).length === 0}
                >
                  {videoBusy ? "生成中…" : "生成（图生视频）"}
                </button>
              </div>
            </div>
          </div>

          {videoUrl && (
            <div className="ref-preview">
              <video className="generated-image" src={videoUrl} controls />
              <a href={videoUrl} target="_blank" rel="noreferrer">
                下载 / 打开视频
              </a>
            </div>
          )}
          {videoError && (
            <p className="ci-meta" style={{ marginTop: 10, color: "#c0392b" }}>
              {videoError}
            </p>
          )}
          {caps && !caps.video.available && (
            <p className="ci-meta" style={{ marginTop: 8 }}>
              未检测到视频 API Key，出视频功能不可用。请先到「设置中心 → 视频模型」填写。
            </p>
          )}

          <div className="back-row">
            <button className="btn btn-primary" onClick={handleComplete} disabled={busy}>
              {busy ? "上架中…" : "完成上架（落库）"}
            </button>
            <button className="btn btn-secondary" onClick={handleFinalize} disabled={busy}>
              {busy ? "上架中…" : "跳过视频，直接上架"}
            </button>
          </div>
          <div className="back-row">
            <button className="btn btn-secondary btn-back-wide" onClick={() => setPhase("copy")} disabled={busy}>
              返回上一步（改文案）
            </button>
          </div>
        </div>
      )}

      {/* Step 6: 完成 */}
      {phase === "done" && (
        <div className="listing-review">
          <div className="step-head">
            <h2 className="step-title">上架完成 🎉</h2>
            <p className="step-desc">
              运营计划已落库，可在运营计划列表查看并确认发布。
            </p>
          </div>
          {current && (
            <div className="result-card">
              <div className="result-row">
                <span className="result-k">商品</span>
                <span className="result-v">{current.name}（ID {current.id}）</span>
              </div>
              <div className="result-row">
                <span className="result-k">运营计划</span>
                <span className="result-v">
                  {planId != null ? `计划 ${planId}` : "落库失败"}
                </span>
              </div>
              {planId != null && (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/operation-plans/${planId}`)}
                >
                  查看运营计划
                </button>
              )}
            </div>
          )}
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
