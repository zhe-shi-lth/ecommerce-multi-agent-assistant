import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../api/settings";
import type { Json } from "../api/types";
import PageHeader from "../components/PageHeader";

interface Settings {
  llm: { enabled: boolean; vendor: string; model: string };
  vision: { vendor: string; model: string };
  image: { enabled: boolean; model: string; edit_model: string; ref_strength: number };
  image_review_enabled: boolean;
  rag_enabled: boolean;
}

const LLM_VENDORS = [
  { key: "dashscope", label: "DashScope（通义千问，需 DASHSCOPE_API_KEY）" },
  { key: "ollama", label: "Ollama（本地，需已启动）" },
  { key: "openai", label: "OpenAI（需 OPENAI_API_KEY）" },
];

// 把后端 Json 规整为本页强类型（缺字段时用默认值兜底）。
function normalize(raw: Json): Settings {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, Json>;
  const llm = (obj.llm && typeof obj.llm === "object" ? obj.llm : {}) as Record<string, Json>;
  const vision = (obj.vision && typeof obj.vision === "object" ? obj.vision : {}) as Record<string, Json>;
  const image = (obj.image && typeof obj.image === "object" ? obj.image : {}) as Record<string, Json>;
  const str = (v: Json, d = "") => (typeof v === "string" ? v : d);
  const bool = (v: Json, d = true) => (typeof v === "boolean" ? v : d);
  const num = (v: Json, d = 0.4) => (typeof v === "number" ? v : typeof v === "string" && !isNaN(Number(v)) ? Number(v) : d);
  return {
    llm: { enabled: bool(llm.enabled, true), vendor: str(llm.vendor, "dashscope"), model: str(llm.model) },
    vision: { vendor: str(vision.vendor, "dashscope"), model: str(vision.model, "qwen-vl-max") },
    image: {
      enabled: bool(image.enabled, true),
      model: str(image.model, "wanx-v1"),
      edit_model: str(image.edit_model, "wanx2.1-imageedit"),
      ref_strength: num(image.ref_strength, 0.4),
    },
    image_review_enabled: bool(obj.image_review_enabled, true),
    rag_enabled: bool(obj.rag_enabled, false),
  };
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then((r) => setSettings(normalize(r)))
      .catch((e) => setError(String(e)));
  }, []);

  function update<K extends keyof Settings>(group: K, patch: Partial<Settings[K]>) {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [group]: { ...(prev[group] as object), ...patch } } as Settings;
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveSettings(settings as unknown as Json);
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <section>
        <PageHeader title="设置中心" subtitle="加载中…" />
        {error && <div className="notice notice-error">出错：{error}</div>}
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="设置中心"
        subtitle="这里的设置会持久化保存（重启后保留），后续生成按此设定走。API Key 等凭证仍在 .env，不在本页。"
      />
      {error && <div className="notice notice-error">出错：{error}</div>}
      {saved && <div className="notice notice-ok">已保存，后续生成按新设定执行。</div>}

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>文本大模型（LLM）</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.llm.enabled}
            onChange={(e) => update("llm", { enabled: e.target.checked })}
          />
          <span>启用 LLM（关闭则 Agent 走规则实现）</span>
        </label>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>厂家</span>
          <select
            value={settings.llm.vendor}
            onChange={(e) => update("llm", { vendor: e.target.value })}
          >
            {LLM_VENDORS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>模型名（留空用厂家默认）</span>
          <input
            value={settings.llm.model}
            placeholder="如 qwen-plus / qwen2.5:latest / gpt-4o-mini"
            onChange={(e) => update("llm", { model: e.target.value })}
          />
        </div>
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>视觉模型（看图写文案）</h3>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>厂家</span>
          <select value={settings.vision.vendor} disabled>
            <option value="dashscope">DashScope（当前唯一支持）</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>模型名</span>
          <input
            value={settings.vision.model}
            placeholder="如 qwen-vl-max"
            onChange={(e) => update("vision", { model: e.target.value })}
          />
        </div>
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>出图模型</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.image.enabled}
            onChange={(e) => update("image", { enabled: e.target.checked })}
          />
          <span>启用真实文生图 / 图生图</span>
        </label>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>文生图模型（无原图时）</span>
          <input
            value={settings.image.model}
            placeholder="如 wanx-v1"
            onChange={(e) => update("image", { model: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>图生图模型（有原图时）</span>
          <input
            value={settings.image.edit_model}
            placeholder="如 wanx2.1-imageedit"
            onChange={(e) => update("image", { edit_model: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>
            图文比重（ref_strength）：{settings.image.ref_strength.toFixed(2)}
            <br />
            <small className="muted">
              越低=原图改动越大；越高=越保留原图。仅对「上传了图→图生图」生效。
            </small>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.image.ref_strength}
            onChange={(e) => update("image", { ref_strength: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>其他开关</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.image_review_enabled}
            onChange={(e) => setSettings((p) => (p ? { ...p, image_review_enabled: e.target.checked } : p))}
          />
          <span>图片视觉审核</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.rag_enabled}
            onChange={(e) => setSettings((p) => (p ? { ...p, rag_enabled: e.target.checked } : p))}
          />
          <span>分类知识库 RAG（需本地嵌入模型可用）</span>
        </label>
      </div>

      <div className="export-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? "保存中…" : "保存设置"}
        </button>
      </div>
    </section>
  );
}
