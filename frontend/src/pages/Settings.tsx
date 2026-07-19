import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../api/settings";
import { LLM_PRESETS, VISION_PRESETS, presetOf } from "../api/presets";
import type { Json } from "../api/types";
import PageHeader from "../components/PageHeader";

interface Settings {
  llm: {
    enabled: boolean;
    vendor: string;
    base_url: string;
    model: string;
    api_key: string;
  };
  vision: {
    vendor: string;
    base_url: string;
    model: string;
    api_key: string;
  };
  image: { enabled: boolean; ref_strength: number };
  image_review_enabled: boolean;
  rag_enabled: boolean;
}

type Group = "llm" | "vision";

// 把后端 Json 规整为本页强类型（缺字段时用默认值兜底）。
function normalize(raw: Json): Settings {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, Json>;
  const llm = (obj.llm && typeof obj.llm === "object" ? obj.llm : {}) as Record<string, Json>;
  const vision = (obj.vision && typeof obj.vision === "object" ? obj.vision : {}) as Record<string, Json>;
  const image = (obj.image && typeof obj.image === "object" ? obj.image : {}) as Record<string, Json>;
  const str = (v: Json, d = "") => (typeof v === "string" ? v : d);
  const bool = (v: Json, d = true) => (typeof v === "boolean" ? v : d);
  const num = (v: Json, d = 0.4) =>
    typeof v === "number" ? v : typeof v === "string" && !isNaN(Number(v)) ? Number(v) : d;
  return {
    llm: {
      enabled: bool(llm.enabled, true),
      vendor: str(llm.vendor, "dashscope"),
      base_url: str(llm.base_url, "https://dashscope.aliyuncs.com/compatible-mode/v1"),
      model: str(llm.model),
      api_key: str(llm.api_key),
    },
    vision: {
      vendor: str(vision.vendor, "dashscope"),
      base_url: str(vision.base_url, "https://dashscope.aliyuncs.com/compatible-mode/v1"),
      model: str(vision.model, "qwen-vl-max"),
      api_key: str(vision.api_key),
    },
    image: {
      enabled: bool(image.enabled, true),
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

  // 选了厂家预设 → 把官方 base_url / 默认模型填进表单（Key 不动，由用户填）。选「自定义」则留空。
  function applyPreset(group: Group, key: string) {
    const preset = presetOf(group === "llm" ? LLM_PRESETS : VISION_PRESETS, key);
    setSettings((prev) => {
      if (!prev) return prev;
      const g = prev[group] as Record<string, string>;
      return {
        ...prev,
        [group]: {
          ...g,
          vendor: key,
          base_url: preset ? preset.base_url : "",
          model: preset ? preset.default_model : "",
        },
      } as Settings;
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
        subtitle="这里的设置会持久化保存（重启后保留），后续生成按此设定走。各厂家均为 OpenAI 兼容协议：选预设后只填 API Key 即可；未填 Key 的云端厂家将走规则/占位，不读取任何配置文件。"
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
          <span>厂家预设</span>
          <select
            value={settings.llm.vendor}
            onChange={(e) => applyPreset("llm", e.target.value)}
          >
            {LLM_PRESETS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>Base URL（OpenAI 兼容）</span>
          <input
            value={settings.llm.base_url}
            placeholder="https://.../v1"
            onChange={(e) => update("llm", { base_url: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>模型名（留空用厂家默认）</span>
          <input
            value={settings.llm.model}
            placeholder="如 qwen-plus / deepseek-chat / gpt-4o-mini"
            onChange={(e) => update("llm", { model: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>
            API Key（可选）
            <br />
            <small className="muted">留空则不使用云端 LLM（Agent 走规则实现）；Ollama 本地可不填。</small>
          </span>
          <input
            type="password"
            value={settings.llm.api_key}
            placeholder="sk-...（留空则用 .env）"
            autoComplete="off"
            onChange={(e) => update("llm", { api_key: e.target.value })}
          />
        </div>
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>视觉模型（看图写文案）</h3>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>厂家预设</span>
          <select
            value={settings.vision.vendor}
            onChange={(e) => applyPreset("vision", e.target.value)}
          >
            {VISION_PRESETS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>Base URL（OpenAI 兼容多模态）</span>
          <input
            value={settings.vision.base_url}
            placeholder="https://.../v1"
            onChange={(e) => update("vision", { base_url: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>模型名</span>
          <input
            value={settings.vision.model}
            placeholder="如 qwen-vl-max / gpt-4o / glm-4v-plus"
            onChange={(e) => update("vision", { model: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>
            API Key（可选）
            <br />
            <small className="muted">
              留空则复用「文本大模型」里填的 Key（出图也用此 Key）。
            </small>
          </span>
          <input
            type="password"
            value={settings.vision.api_key}
            placeholder="sk-...（留空则用 LLM 的 Key）"
            autoComplete="off"
            onChange={(e) => update("vision", { api_key: e.target.value })}
          />
        </div>
      </div>

      <div className="card listing-review">
        <h3 style={{ marginTop: 0 }}>出图模型（DashScope 万相）</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.image.enabled}
            onChange={(e) => update("image", { enabled: e.target.checked })}
          />
          <span>启用真实文生图 / 图生图</span>
        </label>
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
