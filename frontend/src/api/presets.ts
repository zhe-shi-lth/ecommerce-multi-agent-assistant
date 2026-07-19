// 各厂家的 OpenAI 兼容端点与默认模型（按官方文档预置）。
// 选了预设即把 base_url / 默认模型填入表单，用户只需填自己的 API Key；
// 选「自定义」则留空让用户自己填 base_url（任意 OpenAI 兼容端点均可）。

export interface VendorPreset {
  key: string;
  label: string;
  base_url: string;
  default_model: string;
}

// 文本大模型预设（对话 / 结构化输出）。
export const LLM_PRESETS: VendorPreset[] = [
  {
    key: "dashscope",
    label: "通义千问 DashScope",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    default_model: "qwen-plus",
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    base_url: "https://api.deepseek.com/v1",
    default_model: "deepseek-chat",
  },
  {
    key: "moonshot",
    label: "Kimi（月之暗面）",
    base_url: "https://api.moonshot.cn/v1",
    default_model: "moonshot-v1-8k",
  },
  {
    key: "zhipu",
    label: "智谱 GLM",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    default_model: "glm-4",
  },
  {
    key: "openai",
    label: "OpenAI（GPT）",
    base_url: "https://api.openai.com/v1",
    default_model: "gpt-4o-mini",
  },
  {
    key: "gemini",
    label: "Google Gemini",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    default_model: "gemini-2.0-flash",
  },
  {
    key: "ollama",
    label: "Ollama（本地）",
    base_url: "http://localhost:11434/v1",
    default_model: "qwen2.5:latest",
  },
  {
    key: "custom",
    label: "自定义 / 其他 OpenAI 兼容",
    base_url: "",
    default_model: "",
  },
];

// 视觉（看图写文案）预设：需支持多模态（image_url）的端点。
export const VISION_PRESETS: VendorPreset[] = [
  {
    key: "dashscope",
    label: "通义千问 VL（DashScope）",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    default_model: "qwen-vl-max",
  },
  {
    key: "openai",
    label: "GPT-4o（OpenAI）",
    base_url: "https://api.openai.com/v1",
    default_model: "gpt-4o",
  },
  {
    key: "gemini",
    label: "Google Gemini（多模态）",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    default_model: "gemini-2.0-flash",
  },
  {
    key: "zhipu",
    label: "智谱 GLM-4V",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    default_model: "glm-4v-plus",
  },
  {
    key: "moonshot",
    label: "Kimi（月之暗面）",
    base_url: "https://api.moonshot.cn/v1",
    default_model: "moonshot-v1-8k",
  },
  {
    key: "ollama",
    label: "Ollama 本地（需装视觉模型）",
    base_url: "http://localhost:11434/v1",
    default_model: "qwen2.5vl:latest",
  },
  {
    key: "custom",
    label: "自定义 / 其他 OpenAI 兼容",
    base_url: "",
    default_model: "",
  },
];

export function presetOf(list: VendorPreset[], key: string): VendorPreset | undefined {
  return list.find((p) => p.key === key);
}
