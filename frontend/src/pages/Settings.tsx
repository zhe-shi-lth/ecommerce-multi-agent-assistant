import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../api/settings";
import { getCatalog, type ModelCatalog } from "../api/catalog";
import type { Json } from "../api/types";
import { PLATFORMS } from "../platforms";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

interface CardSettings {
  enabled?: boolean;
  vendor: string;
  base_url: string;
  model: string;
  api_key: string;
  edit_model?: string;
  ref_strength?: number;
}

// 平台对接凭证：一个平台一份，字段与后端 settings_store._PLATFORM_API_FIELDS 对齐。
interface PlatformApiSettings {
  enabled: boolean;
  app_key: string;
  app_secret: string;
  endpoint: string;
  shop_id: string;
  access_token: string;
}

interface Settings {
  llm: CardSettings & { enabled: boolean };
  image: CardSettings & { enabled: boolean; edit_model: string; ref_strength: number };
  video: CardSettings & { enabled: boolean };
  monitor: CardSettings & { enabled: boolean };
  platform_api: Record<string, PlatformApiSettings>;
  image_review_enabled: boolean;
  rag_enabled: boolean;
}

type Group = "llm" | "image" | "video" | "monitor";

// 各平台在开放平台后台里的取值位置说明（面向商家/运营，不涉及内部实现）。
const PLATFORM_API_HINTS: Record<
  string,
  { console: string; shopIdLabel: string; shopIdHint: string }
> = {
  taobao: {
    console: "淘宝开放平台 → 应用管理，取应用的 App Key / App Secret；店铺授权后得到访问令牌。",
    shopIdLabel: "卖家昵称",
    shopIdHint: "淘宝店铺的卖家账号昵称。",
  },
  douyin: {
    console: "抖店开放平台 → 应用详情，取 App Key / App Secret；店铺授权后得到访问令牌。",
    shopIdLabel: "抖店店铺 ID",
    shopIdHint: "抖店后台「店铺信息」中的店铺 ID。",
  },
  xiaohongshu: {
    console: "小红书开放平台 → 应用管理，取 App Id / App Secret；店铺授权后得到访问令牌。",
    shopIdLabel: "小红书店铺 ID",
    shopIdHint: "小红书千帆后台的店铺（卖家）ID。",
  },
};

// 把后端 Json 规整为本页强类型（缺字段时用默认值兜底）。
function normalize(raw: Json): Settings {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, Json>;
  const pick = (name: string) => ((obj[name] && typeof obj[name] === "object" ? obj[name] : {}) as Record<string, Json>);
  const llm = pick("llm");
  const image = pick("image");
  const video = pick("video");
  const monitor = pick("monitor");
  const platformApi = pick("platform_api");
  const str = (v: Json, d = "") => (typeof v === "string" ? v : d);
  const bool = (v: Json, d = true) => (typeof v === "boolean" ? v : d);
  const num = (v: Json, d = 0.4) =>
    typeof v === "number" ? v : typeof v === "string" && !isNaN(Number(v)) ? Number(v) : d;
  return {
    llm: {
      enabled: bool(llm.enabled, true),
      vendor: str(llm.vendor, "dashscope"),
      base_url: str(llm.base_url),
      model: str(llm.model, "qwen3.7-plus"),
      api_key: str(llm.api_key),
    },
    image: {
      enabled: bool(image.enabled, true),
      vendor: str(image.vendor, "qwen"),
      base_url: str(image.base_url),
      model: str(image.model, "qwen-image-2.0-pro-2026-06-22"),
      edit_model: str(image.edit_model, "qwen-image-2.0-pro-2026-06-22"),
      api_key: str(image.api_key),
      ref_strength: num(image.ref_strength, 0.4),
    },
    video: {
      enabled: bool(video.enabled, true),
      vendor: str(video.vendor, "dashscope"),
      base_url: str(video.base_url),
      model: str(video.model, "wan2.7-t2v"),
      api_key: str(video.api_key),
    },
    monitor: {
      enabled: bool(monitor.enabled, false),
      vendor: str(monitor.vendor, "dashscope"),
      base_url: str(monitor.base_url, "https://dashscope.aliyuncs.com/compatible-mode/v1"),
      model: str(monitor.model, "qwen3.7-plus"),
      api_key: str(monitor.api_key),
    },
    // 平台维度以前端 PLATFORMS 为准（与后端 PLATFORM_KEYS 一致），后端缺块时补空表单。
    platform_api: Object.fromEntries(
      PLATFORMS.map((p) => {
        const raw = platformApi[p.key];
        const b = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, Json>;
        return [
          p.key,
          {
            enabled: bool(b.enabled, false),
            app_key: str(b.app_key),
            app_secret: str(b.app_secret),
            endpoint: str(b.endpoint),
            shop_id: str(b.shop_id),
            access_token: str(b.access_token),
          },
        ];
      })
    ),
    image_review_enabled: bool(obj.image_review_enabled, true),
    rag_enabled: bool(obj.rag_enabled, false),
  };
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // 动态切换：上架设置（文案/图片/视频 + 其他开关）、监控模型设置、平台对接 分成三个视图，不挤在一个长页面。
  const [tab, setTab] = useState<"listing" | "monitor" | "platform">("listing");

  useEffect(() => {
    getSettings()
      .then((r) => setSettings(normalize(r)))
      .catch((e) => setError(String(e)));
    getCatalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  function update<K extends keyof Settings>(group: K, patch: Partial<Settings[K]>) {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [group]: { ...(prev[group] as object), ...patch } } as Settings;
    });
    setSaved(false);
  }

  // 平台对接：platform_api 是「平台 → 凭证」两层结构，通用 update 只能覆盖整块，这里单独处理。
  function updatePlatform(key: string, patch: Partial<PlatformApiSettings>) {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        platform_api: { ...prev.platform_api, [key]: { ...prev.platform_api[key], ...patch } },
      };
    });
    setSaved(false);
  }

  // 选厂家：已知厂家自动填入默认模型 + 派生 base_url；custom 保留手填。
  function onVendorChange(group: Group, vendor: string) {
    setSettings((prev) => {
      if (!prev) return prev;
      const g = prev[group] as CardSettings;
      const entry = catalog?.[group]?.[vendor];
      const isCustom = vendor === "custom";
      const models = entry?.models ?? [];
      const firstModel = models[0]?.id ?? "";
      const editDefault =
        models.find((m) => m.id.includes("imageedit"))?.id ?? firstModel;
      const next: CardSettings = {
        ...g,
        vendor,
        model: isCustom ? g.model : firstModel,
        base_url: isCustom ? g.base_url : (entry?.base_url ?? ""),
      };
      if (group === "image") {
        next.edit_model = isCustom ? g.edit_model : editDefault;
      }
      return { ...prev, [group]: next } as Settings;
    });
    setSaved(false);
  }

  // 选模型：已知厂家的 base_url 跟随厂家派生（只读），custom 保持手填。
  function onModelChange(group: Group, model: string) {
    setSettings((prev) => {
      if (!prev) return prev;
      const g = prev[group] as CardSettings;
      const entry = catalog?.[group]?.[g.vendor];
      const base_url = g.vendor === "custom" ? g.base_url : (entry?.base_url ?? "");
      return { ...prev, [group]: { ...g, model, base_url } } as Settings;
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
        <PageHeader title="设置中心" subtitle="加载中…" icon={<Icon name="settings" />} />
        {error && <div className="notice notice-error">出错：{error}</div>}
      </section>
    );
  }

  const vendorOptions = (group: Group) =>
    catalog?.[group] ? Object.entries(catalog[group]).map(([key, v]) => ({ key, label: v.label })) : [];
  const modelOptions = (group: Group) => catalog?.[group]?.[settings[group].vendor]?.models ?? [];

  // 渲染一个能力卡片的「厂家 + 模型 + 派生 base_url + Key」通用部分。
  function renderCardBody(group: Group) {
    if (!settings) return null;
    const g = settings[group] as CardSettings;
    const isCustom = g.vendor === "custom";
    const models = modelOptions(group);
    return (
      <>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>厂家</span>
          <select value={g.vendor} onChange={(e) => onVendorChange(group, e.target.value)}>
            {vendorOptions(group).map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <span>模型（从厂家支持的列表中选择）</span>
          {isCustom ? (
            <input
              value={g.model}
              placeholder="自定义模型名（手填）"
              onChange={(e) => onModelChange(group, e.target.value)}
            />
          ) : (
            <select value={g.model} onChange={(e) => onModelChange(group, e.target.value)}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <span>Base URL（由厂家+模型派生，{isCustom ? "自定义需手填" : "只读"}）</span>
          <input
            value={g.base_url}
            placeholder={isCustom ? "https://.../v1 或 /api/v1/..." : "（由所选厂家自动派生）"}
            readOnly={!isCustom}
            onChange={(e) => isCustom && update(group, { base_url: e.target.value })}
          />
          {!isCustom && !g.base_url && (
            <small className="muted">
              该厂家走官方 SDK 默认端点（仅用 API Key 鉴权），无需填写 Base URL。
            </small>
          )}
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <span>
            API Key（{group === "monitor" ? "库存监控" : group === "video" ? "视频" : group === "image" ? "图片" : "文案"}卡片独立填写）
            <br />
            <small className="muted">不借用其它卡片、不读 .env；缺 Key 将直接报错（不降级）。</small>
          </span>
          <input
            type="password"
            value={g.api_key}
            placeholder="sk-..."
            autoComplete="off"
            onChange={(e) => update(group, { api_key: e.target.value })}
          />
        </div>
      </>
    );
  }

  // 订单监控（地址复核）独立卡片：已改为模式无关，无需配置（不再有 mode / 通过率）。
  function renderOrderMonitorCard() {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        地址复核已统一为<strong>模式无关</strong>：商家在订单详情点「确认地址已补全」时，系统经平台适配器复核地址是否真已补全——
        未配置平台凭证时返回与真实平台同构的模拟真相（稳定、可复现），配置凭证后自动改查真实开放 API（address_complete），
        <strong>无需切换模式、零代码改动</strong>。与定时轮询共用同一套逻辑，避免盲目信任人工操作。
      </p>
    );
  }

  // 平台对接卡片：一个电商平台一张，填开放平台给到的应用凭证 + 店铺授权令牌。
  function renderPlatformCard(key: string, label: string) {
    if (!settings) return null;
    const p = settings.platform_api[key];
    if (!p) return null;
    const hint = PLATFORM_API_HINTS[key];
    const ready = p.enabled && !!p.app_key && !!p.app_secret && !!p.access_token;
    const tone = !p.enabled ? "badge-neutral" : ready ? "badge-ok" : "badge-warn";
    return (
      <div className="card listing-review" key={key}>
        <h3 style={{ marginTop: 0 }}>
          {label}
          <span className={`badge ${tone}`} style={{ marginLeft: 10 }}>
            {p.enabled ? (ready ? "已就绪" : "凭证不完整") : "未开启"}
          </span>
        </h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={p.enabled}
            onChange={(e) => updatePlatform(key, { enabled: e.target.checked })}
          />
          <span>开启{label}对接（关闭则不从该平台取数）</span>
        </label>

        <div className="field" style={{ marginBottom: 12 }}>
          <span>
            App Key
            <br />
            <small className="muted">{hint?.console}</small>
          </span>
          <input
            value={p.app_key}
            placeholder="开放平台应用的 App Key"
            autoComplete="off"
            onChange={(e) => updatePlatform(key, { app_key: e.target.value })}
          />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <span>App Secret</span>
          <input
            type="password"
            value={p.app_secret}
            placeholder="开放平台应用的密钥"
            autoComplete="off"
            onChange={(e) => updatePlatform(key, { app_secret: e.target.value })}
          />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <span>
            店铺授权令牌
            <br />
            <small className="muted">店铺完成授权后拿到的访问令牌，缺它无法读取该店订单。</small>
          </span>
          <input
            type="password"
            value={p.access_token}
            placeholder="店铺授权后获得的访问令牌"
            autoComplete="off"
            onChange={(e) => updatePlatform(key, { access_token: e.target.value })}
          />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <span>
            {hint?.shopIdLabel ?? "店铺 ID"}
            <br />
            <small className="muted">{hint?.shopIdHint}</small>
          </span>
          <input
            value={p.shop_id}
            placeholder="选填，多店铺时用于区分"
            autoComplete="off"
            onChange={(e) => updatePlatform(key, { shop_id: e.target.value })}
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <span>
            接口地址（选填）
            <br />
            <small className="muted">留空即使用该平台的官方地址；只有走沙箱或自建代理时才需要填。</small>
          </span>
          <input
            value={p.endpoint}
            placeholder="https://..."
            autoComplete="off"
            onChange={(e) => updatePlatform(key, { endpoint: e.target.value })}
          />
        </div>
      </div>
    );
  }

  return (
    <section>
      <PageHeader
        title="设置中心"
        subtitle="按用途组织：上架设置（文案 / 图片 / 视频）、监控模型设置、平台对接（各电商平台的订单接口凭证）。每张模型卡片各自选厂家+模型，Base URL 自动派生，互不借用、互不借 Key。"
        icon={<Icon name="settings" />}
      />
      {error && <div className="notice notice-error">出错：{error}</div>}
      {saved && <div className="notice notice-ok">已保存，后续生成按新设定执行。</div>}

      <div className="settings-tabs">
        <button
          className={`settings-tab${tab === "listing" ? " active" : ""}`}
          onClick={() => setTab("listing")}
        >
          <Icon name="new" /> 上架设置
        </button>
        <button
          className={`settings-tab${tab === "monitor" ? " active" : ""}`}
          onClick={() => setTab("monitor")}
        >
          <Icon name="dashboard" /> 监控模型设置
        </button>
        <button
          className={`settings-tab${tab === "platform" ? " active" : ""}`}
          onClick={() => setTab("platform")}
        >
          <Icon name="simulator" /> 平台对接
        </button>
      </div>

      {tab === "listing" && (
        <>
          <div className="card listing-review">
            <h3 style={{ marginTop: 0 }}>文案生成模型</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.llm.enabled}
                onChange={(e) => update("llm", { enabled: e.target.checked })}
              />
              <span>启用文案生成（关闭则 Agent 走规则实现，不调用大模型）</span>
            </label>
            {renderCardBody("llm")}
            <p className="muted" style={{ marginTop: 8 }}>
              用于根据商品信息与商家备注，自动生成商品文案（卖点、标题、详情等）。
            </p>
          </div>

          <div className="card listing-review">
            <h3 style={{ marginTop: 0 }}>商品图片生成模型</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.image.enabled}
                onChange={(e) => update("image", { enabled: e.target.checked })}
              />
              <span>启用商品图片生成（关闭则走规则占位图）</span>
            </label>
            {renderCardBody("image")}
            <div className="field" style={{ marginBottom: 12 }}>
              <span>
                参考图保留程度（ref_strength）：{settings.image.ref_strength.toFixed(2)}
                <br />
                <small className="muted">
                  仅在你上传参考图、走「图生图」时生效：越低=原图改动越大；越高=越保留原图。不传参考图时系统自动用「文生图」。
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
            <p className="muted" style={{ marginTop: 8 }}>
              用于生成商品主图。是否走「图生图」由你在上架流程里是否上传参考图决定，无需在此单独选择模型。
            </p>
          </div>

          <div className="card listing-review">
            <h3 style={{ marginTop: 0 }}>视频生成模型</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.video.enabled}
                onChange={(e) => update("video", { enabled: e.target.checked })}
              />
              <span>启用视频生成（关闭则 Agent 跳过视频生成，不调用大模型）</span>
            </label>
            {renderCardBody("video")}
            <p className="muted" style={{ marginTop: 8 }}>
              用于在上架流程中，根据商品主图/文案生成商品宣传短视频（如万相、欢乐马等视频生成模型）。
            </p>
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
        </>
      )}

      {tab === "monitor" && (
        <>
          <div className="card listing-review">
            <h3 style={{ marginTop: 0 }}>库存监控模型</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.monitor.enabled}
                onChange={(e) => update("monitor", { enabled: e.target.checked })}
              />
              <span>启用库存监控大模型（关闭或配置错误时，按可售天数&lt;5天红线预警，不报错）</span>
            </label>
            {renderCardBody("monitor")}
            <p className="muted" style={{ marginTop: 8 }}>
              用于「销售监控」页的库存预警：判断未来 30 天可能推高销量的大促/节日，给出智能预警。
              未启用或配置错误时自动降级为红线预警（仅按可售天数）。
            </p>
          </div>

          <div className="card listing-review">
            <h3 style={{ marginTop: 0 }}>订单监控（地址复核）</h3>
            {renderOrderMonitorCard()}
          </div>
        </>
      )}

      {tab === "platform" && (
        <>
          <div className="notice notice-warn" style={{ justifyContent: "flex-start" }}>
            <span>
              当前系统使用<strong>模拟订单数据</strong>运行，所有页面与流程都已按真实拉单打通。
              在下面填好各平台的对接凭证、并由运维把订单来源切到真实平台后，
              订单会改为从平台开放 API 拉取，<strong>页面与操作方式完全不变</strong>。
            </span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            凭证只保存在本系统后端，不会写进代码或配置文件；未开启的平台不会被访问。
          </p>
          {PLATFORMS.map((p) => renderPlatformCard(p.key, p.label))}
        </>
      )}

      <div className="export-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? "保存中…" : "保存设置"}
        </button>
      </div>
    </section>
  );
}
