"""运行时设置中心：把原先散落在 .env 的开关/模型选择，改为可经 UI 实时修改并持久化。

- 持久化到本文件同级的 settings.json（已 gitignore），重启后保留用户选择。
- 未生成 settings.json 时使用 DEFAULT_SETTINGS（与历史 .env 默认值保持一致）。
- LLM / 视觉采用「OpenAI 兼容」协议：设置中心可按官方文档填写各厂家的 base_url / 模型 /
  API Key（前端提供常见厂家预设 + 自定义）。API Key 留空则回退 .env 的对应变量。
- 出图（万相）目前仅 DashScope，Key 复用视觉/LLM 卡片里填写的 DashScope Key。
- save_settings 会清掉 LLM 客户端缓存，使厂家/模型/Key 切换立即生效。
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from app import config

# 存到仓库根的 data/ 下，刻意放在 python-agent-service 源码树之外——
# 否则 fastapi dev 的 --reload 监听会把它当成源码变更，保存设置时反复重启服务。
SETTINGS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "settings.json"

DEFAULT_SETTINGS: dict[str, Any] = {
    # 文本 LLM（OpenAI 兼容）：启用开关 + 厂家预设键 + base_url + 模型名（空串=厂家默认）
    # + 云端 API Key（UI 可填，存本地 settings.json；不读 .env，页面即唯一配置来源）。
    "llm": {
        "enabled": True,
        "vendor": "dashscope",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "",
        "api_key": "",
    },
    # 视觉模型（看图写文案，OpenAI 兼容多模态）：厂家预设键 + base_url + 模型 + API Key。
    # api_key 留空则复用 LLM 卡片的 Key，再回退 .env 的 DASHSCOPE_API_KEY。
    "vision": {
        "vendor": "dashscope",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-vl-max",
        "api_key": "",
    },
    # 出图：开关 + 文生图模型 + 图生图模型 + 图文比重(ref_strength)
    "image": {
        "enabled": True,
        "model": "wanx-v1",
        "edit_model": "wanx2.1-imageedit",
        "ref_strength": 0.4,
    },
    "image_review_enabled": True,
    "rag_enabled": False,
}

# 可重入锁：save_settings 持锁期间会调用 load_settings（同样取锁），
# 必须用 RLock，否则普通 Lock 会死锁导致请求挂起（PUT 一直 000）。
_lock = threading.RLock()
_cache: dict[str, Any] | None = None


def _deep_merge(base: dict, override: dict) -> dict:
    """浅层合并（顶层为各配置块），override 中缺失的块沿用 base。"""
    merged = dict(base)
    for key, val in (override or {}).items():
        if isinstance(val, dict) and isinstance(base.get(key), dict):
            merged[key] = {**base[key], **val}
        else:
            merged[key] = val
    return merged


def load_settings() -> dict[str, Any]:
    """返回当前设置（带缓存）；首次读取时与 settings.json 合并默认值。"""
    global _cache
    with _lock:
        if _cache is not None:
            return _cache
        data = DEFAULT_SETTINGS
        if SETTINGS_PATH.exists():
            try:
                user = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
                data = _deep_merge(DEFAULT_SETTINGS, user)
            except Exception:
                data = DEFAULT_SETTINGS
        _cache = data
        return data


def get_settings() -> dict[str, Any]:
    return load_settings()


def save_settings(patch: dict[str, Any]) -> dict[str, Any]:
    """合并补丁并持久化；清 LLM 客户端缓存，使厂家/模型切换即时生效。"""
    global _cache
    with _lock:
        data = _deep_merge(load_settings(), patch)
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        _cache = data
    # 通知 LLM 客户端：设置变了，下次生成重新构造（应用新厂家/模型）
    try:
        from app.llm import client as llm_client

        llm_client.reset()
    except Exception:  # noqa: BLE001
        pass
    return data


def resolve_dashscope_api_key() -> str:
    """解析 DashScope API Key（出图/图生图专用，目前仅 DashScope 支持）。

    只来自页面设置：视觉卡片 api_key → LLM 卡片 api_key。不再回退 .env —— 面向最终用户，
    Key 一律在「设置中心」页面填写；两处都没填则出图降级为占位图。
    """
    s = get_settings()
    key = (s.get("vision", {}) or {}).get("api_key", "") or ""
    if not key:
        key = (s.get("llm", {}) or {}).get("api_key", "") or ""
    return (key or "").strip()


def capabilities() -> dict[str, Any]:
    """探测各模型功能当前是否可用（基于部署开关 + 运行时设置 + 是否填了 Key）。

    用于在「未配置 API Key」时让前端提前拦截大模型功能（看图写文案 / 文生图 / 图生图），
    而不是静默走规则降级或后端报错。仅做本地判定（Key 是否存在、开关是否打开），不发网络请求。
    """
    s = get_settings()
    llm_block = s.get("llm", {}) or {}
    vision_block = s.get("vision", {}) or {}
    image_block = s.get("image", {}) or {}

    # 文本 LLM
    llm_reason = ""
    llm_ok = bool(config.LLM_ENABLED)
    if not llm_ok:
        llm_reason = "部署环境已关闭 LLM（LLM_ENABLED=false）"
    elif not llm_block.get("enabled", True):
        llm_ok = False
        llm_reason = "LLM 已在设置中心关闭"
    else:
        vendor = (llm_block.get("vendor") or "dashscope").strip()
        key = (llm_block.get("api_key") or "").strip()
        if not key and vendor != "ollama":
            llm_ok = False
            llm_reason = "未填写 LLM 的 API Key（请在设置中心填写）"

    # 视觉（看图写文案）：Key 来自视觉卡片或 LLM 卡片
    vis_key = (vision_block.get("api_key") or "").strip() or (llm_block.get("api_key") or "").strip()
    vis_ok = bool(vis_key)
    vision_reason = "" if vis_ok else "未填写视觉/LLM 的 API Key（请在设置中心填写）"

    # 出图（文生图/图生图）：仅 DashScope，Key 来自视觉/LLM 卡片
    img_ok = bool(image_block.get("enabled", True)) and bool(resolve_dashscope_api_key())
    if not image_block.get("enabled", True):
        image_reason = "出图已在设置中心关闭"
    elif not resolve_dashscope_api_key():
        image_reason = "未填写 DashScope API Key（出图用，请在设置中心填写）"
    else:
        image_reason = ""

    return {
        "llm": {"available": llm_ok, "reason": llm_reason},
        "vision": {"available": vis_ok, "reason": vision_reason},
        "image": {"available": img_ok, "reason": image_reason},
    }


def resolve_vision_credentials() -> tuple[str, str, str]:
    """解析视觉（看图写文案）的 (base_url, api_key, model)。

    均为 OpenAI 兼容多模态端点，只来自页面「视觉模型」卡片：
    - base_url / model：卡片值优先，留空回退 DashScope 兼容端点与 qwen-vl-max（首启默认值）。
    - api_key：视觉卡片 Key → LLM 卡片 Key；都没填则无 Key（该能力走规则/降级）。
    支持通义千问 VL / GPT-4o / 智谱 GLM-4V / Kimi / Ollama 本地等多模态厂家。
    """
    s = get_settings()
    vis = s.get("vision", {}) or {}
    base_url = (vis.get("base_url") or "").strip() or config.DASHSCOPE_BASE_URL
    model = (vis.get("model") or "").strip() or "qwen-vl-max"
    api_key = (vis.get("api_key") or "").strip()
    if not api_key:
        api_key = (s.get("llm", {}) or {}).get("api_key", "") or ""
    return base_url, (api_key or "").strip(), model
