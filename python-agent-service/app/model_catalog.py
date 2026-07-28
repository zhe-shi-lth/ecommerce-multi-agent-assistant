"""模型目录（单一事实来源）：厂家 + 模型选择，base_url 由厂家+模型派生。

设计目标（对应「选厂家 + 选模型」而非手填模型名）：
- 每个能力（llm / image / video）下按厂家组织可用模型列表，
  每个模型条目携带 id / label / api_style / 派生 base_url。
- api_style 决定后端调用方式：
  - "openai"           ：OpenAI 兼容 /v1。LLM 走 /v1/chat/completions；
                          出图走 /v1/images/generations（+ /images/edits），base_url 为兼容端点。
  - "dashscope_image" ：阿里云 qwen-image 原生 SDK（dashscope.MultiModalConversation.call），
                          文生图与图生图统一走此官方接口，不经 OpenAI 兼容层。
  - "dashscope_video"  ：DashScope 原生 /api/v1/.../video-synthesis（model+input+parameters，异步任务）。
  - "rule"             ：离线/规则模式，不调用任何外部模型。
  - 出图多厂家：qwen 走 dashscope_image 官方 SDK；openai 走官方 openai SDK；
                          google 走 google-genai（gemini interactions）；stability 走官方 REST v2beta。
                          各厂家均按官方文档实现专用适配器，不存在“OpenAI 兼容兜底”或静默降级。
- 已知厂家的 base_url 由目录派生（只读）；仅 "custom" 允许前端手填 base_url + 模型名。
- 后端用本目录校验「已知厂家的模型必须在列表内」，从根本上杜绝
  `happyhorse-1.0-video-edit` 被错配到 OpenAI 兼容端点导致 404。

所有模型名均来自官方文档预置；新增模型只需在此扩展，前端下拉自动跟随。
"""
from __future__ import annotations

from typing import Any

# 通义千问 / 万相 VL 的 OpenAI 兼容端点（/compatible-mode/v1）。
DASHSCOPE_COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
# 万相 / 欢乐马视频的原生端点（/api/v1，model+input+parameters + 异步任务）。
DASHSCOPE_VIDEO_URL = (
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
)

# catalog[capability][vendor] = { label, api_style, base_url, models:[{id,label,kind?}] }
CATALOG: dict[str, dict[str, dict[str, Any]]] = {
    "llm": {
        "dashscope": {
            "label": "通义千问（阿里云 DashScope）",
            "api_style": "openai",
            "base_url": DASHSCOPE_COMPAT_URL,
            "models": [
                {"id": "qwen3.8-max-preview", "label": "Qwen3.8 Max（最新预览旗舰）"},
                {"id": "qwen3.7-max", "label": "Qwen3.7 Max（当前旗舰）"},
                {"id": "qwen3.7-plus", "label": "Qwen3.7 Plus（均衡推荐）"},
                {"id": "qwen3.7-flash", "label": "Qwen3.7 Flash（最快/最省）"},
                {"id": "qwen3.6-plus", "label": "Qwen3.6 Plus（稳定）"},
                {"id": "qwen3.5-plus", "label": "Qwen3.5 Plus（稳定主流）"},
            ],
        },
        "deepseek": {
            "label": "DeepSeek",
            "api_style": "openai",
            "base_url": "https://api.deepseek.com/v1",
            "models": [
                {"id": "deepseek-chat", "label": "DeepSeek V3（deepseek-chat）"},
                {"id": "deepseek-reasoner", "label": "DeepSeek R1（deepseek-reasoner，推理）"},
            ],
        },
        "moonshot": {
            "label": "Kimi（月之暗面）",
            "api_style": "openai",
            "base_url": "https://api.moonshot.cn/v1",
            "models": [
                {"id": "moonshot-v1-128k", "label": "Kimi V1 128K"},
                {"id": "moonshot-v1-32k", "label": "Kimi V1 32K"},
                {"id": "moonshot-v1-8k", "label": "Kimi V1 8K"},
            ],
        },
        "zhipu": {
            "label": "智谱 GLM",
            "api_style": "openai",
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
            "models": [
                {"id": "glm-4-plus", "label": "GLM-4-Plus（最强）"},
                {"id": "glm-4", "label": "GLM-4"},
                {"id": "glm-4-flash", "label": "GLM-4-Flash（免费）"},
            ],
        },
        "openai": {
            "label": "OpenAI（GPT）",
            "api_style": "openai",
            "base_url": "https://api.openai.com/v1",
            "models": [
                {"id": "gpt-4.1", "label": "GPT-4.1"},
                {"id": "gpt-4.1-mini", "label": "GPT-4.1-mini"},
                {"id": "gpt-4o", "label": "GPT-4o"},
                {"id": "gpt-4o-mini", "label": "GPT-4o-mini"},
            ],
        },
        "gemini": {
            "label": "Google Gemini",
            "api_style": "openai",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
            "models": [
                {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
                {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
                {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
            ],
        },
        "ollama": {
            "label": "Ollama（本地）",
            "api_style": "openai",
            "base_url": "http://localhost:11434/v1",
            "models": [
                {"id": "qwen2.5:latest", "label": "Qwen2.5 (local)"},
                {"id": "llama3.1:latest", "label": "Llama3.1 (local)"},
            ],
        },
        "rule": {
            "label": "规则模式（离线，不调用 LLM）",
            "api_style": "rule",
            "base_url": "",
            "models": [{"id": "", "label": "（规则 / 确定性输出）"}],
        },
        "custom": {
            "label": "自定义 / 其他 OpenAI 兼容",
            "api_style": "openai",
            "base_url": "",
            "models": [{"id": "", "label": "自定义模型（手填）"}],
        },
    },
    "image": {
        # 阿里云百炼 qwen-image：走官方 SDK（dashscope.MultiModalConversation.call），文生图/图生图统一接口。
        "qwen": {
            "label": "通义千问 qwen-image（阿里云 DashScope）",
            "api_style": "dashscope_image",
            "base_url": "",
            "models": [
                {"id": "qwen-image-2.0-pro-2026-06-22", "label": "Qwen-Image 2.0 Pro（你的试用）"},
                {"id": "qwen-image", "label": "Qwen-Image（通用别名）"},
            ],
        },
        # OpenAI 官方：GPT-Image-1 / DALL·E 3，标准 /v1/images/generations。
        "openai": {
            "label": "OpenAI（GPT-Image / DALL·E）",
            "api_style": "openai",
            "base_url": "https://api.openai.com/v1",
            "models": [
                {"id": "gpt-image-1", "label": "GPT-Image-1"},
                {"id": "dall-e-3", "label": "DALL·E 3"},
            ],
        },
        # Google Gemini（nano-banana）/ Imagen：走官方 google-genai（client.interactions.create）。
        "google": {
            "label": "Google Gemini / Imagen",
            "api_style": "google_genai",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
            "models": [
                {"id": "gemini-2.5-flash-image", "label": "Gemini 2.5 Flash Image（nano-banana）"},
                {"id": "imagen-3.0-generate-001", "label": "Imagen 3"},
            ],
        },
        # Stability AI（Stable Diffusion 3.5）：走官方 REST v2beta（无维护中的 Python SDK，直接 HTTP）。
        "stability": {
            "label": "Stability AI（Stable Diffusion 3.5）",
            "api_style": "stability_rest",
            "base_url": "https://api.stability.ai/v2beta",
            "models": [
                {"id": "sd3.5-large", "label": "SD 3.5 Large"},
                {"id": "sd3.5-large-turbo", "label": "SD 3.5 Large Turbo"},
                {"id": "sd3.5-medium", "label": "SD 3.5 Medium"},
            ],
        },
        "custom": {
            "label": "自定义 / 其他 OpenAI 兼容出图",
            "api_style": "openai",
            "base_url": "",
            "models": [{"id": "", "label": "自定义模型（手填）"}],
        },
    },
    "video": {
        "dashscope": {
            "label": "通义万相 / 欢乐马（阿里云 DashScope）",
            "api_style": "dashscope_video",
            "base_url": DASHSCOPE_VIDEO_URL,
            "models": [
                # 文生视频（t2v）
                {"id": "wan2.7-t2v-2026-06-12", "label": "万相 文生视频 wan2.7-t2v-2026-06-12", "kind": "t2v"},
                {"id": "wan2.7-t2v", "label": "万相 文生视频 wan2.7-t2v（通用别名）", "kind": "t2v"},
                {"id": "happyhorse-1.1-t2v", "label": "欢乐马 文生视频 happyhorse-1.1-t2v", "kind": "t2v"},
                # 图生视频（i2v）
                {"id": "wan2.7-i2v-2026-04-25", "label": "万相 图生视频 wan2.7-i2v-2026-04-25", "kind": "i2v"},
                {"id": "wan2.7-i2v", "label": "万相 图生视频 wan2.7-i2v（通用别名）", "kind": "i2v"},
                {"id": "happyhorse-1.1-i2v", "label": "欢乐马 图生视频 happyhorse-1.1-i2v", "kind": "i2v"},
                # 视频编辑（edit）
                {"id": "happyhorse-1.0-video-edit", "label": "欢乐马 视频编辑 happyhorse-1.0-video-edit", "kind": "edit"},
                {"id": "wan2.7-videoedit", "label": "万相 视频编辑 wan2.7-videoedit", "kind": "edit"},
            ],
        },
        "custom": {
            "label": "自定义 / 其他 DashScope 兼容原生端点",
            "api_style": "dashscope_video",
            "base_url": "",
            "models": [{"id": "", "label": "自定义模型（手填）"}],
        },
    },
}

# 库存监控（线2 智能预警）复用文本 LLM 的厂家+模型目录（同为 OpenAI 兼容协议），
# 但作为独立卡片配置，互不借用 Key / 不读全局 LLM 设置。
CATALOG["monitor"] = CATALOG["llm"]


def get_catalog() -> dict[str, dict[str, dict[str, Any]]]:
    return CATALOG


def _vendor_entry(capability: str, vendor: str) -> dict[str, Any] | None:
    return CATALOG.get(capability, {}).get(vendor)


def is_known_vendor(capability: str, vendor: str) -> bool:
    return vendor in CATALOG.get(capability, {})


def default_model(capability: str, vendor: str) -> str:
    """返回某能力+厂家的默认模型 id（目录第一项；rule/custom 为空串）。"""
    entry = _vendor_entry(capability, vendor)
    if not entry:
        return ""
    models = entry.get("models") or []
    if not models:
        return ""
    return models[0]["id"]


def api_style_of(capability: str, vendor: str) -> str:
    entry = _vendor_entry(capability, vendor)
    return (entry or {}).get("api_style", "openai")


def resolve_base_url(capability: str, vendor: str, model: str = "", base_url: str = "") -> str:
    """返回该能力+厂家应使用的 base_url。

    - 已知厂家：用目录派生值（rule / dashscope_image 派生命名为空串）。
    - "custom"：用调用方传入的 base_url（可空，由用户手填）。
    """
    entry = _vendor_entry(capability, vendor)
    if entry is None:
        return base_url  # 未知厂家（理论不会发生）：回退手填
    if vendor == "custom":
        return (base_url or "").strip()
    return (entry.get("base_url") or "").strip()


def validate_selection(capability: str, vendor: str, model: str) -> bool:
    """已知厂家的 model 必须在目录内（允许空串=用默认）；custom 允许任意。"""
    if capability not in CATALOG:
        return False
    if vendor not in CATALOG[capability]:
        return False
    if vendor == "custom":
        return True
    if model == "":
        return True
    ids = [m["id"] for m in CATALOG[capability][vendor].get("models", [])]
    return model in ids


def model_kind(capability: str, vendor: str, model: str) -> str | None:
    """video 专用：返回模型 kind（t2v / i2v / edit）。"""
    entry = _vendor_entry(capability, vendor)
    if not entry:
        return None
    for m in entry.get("models", []):
        if m["id"] == model:
            return m.get("kind")
    return None
