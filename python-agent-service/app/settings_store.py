"""运行时设置中心：把原先散落在 .env 的开关/模型选择，改为可经 UI 实时修改并持久化。

- 持久化到本文件同级的 settings.json（已 gitignore），重启后保留用户选择。
- 未生成 settings.json 时使用 DEFAULT_SETTINGS（与历史 .env 默认值保持一致）。
- 凭证（API key / base_url）仍走 .env，不进 settings.json、不进 UI。
- save_settings 会清掉 LLM 客户端缓存，使厂家/模型切换立即生效。
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

# 存到仓库根的 data/ 下，刻意放在 python-agent-service 源码树之外——
# 否则 fastapi dev 的 --reload 监听会把它当成源码变更，保存设置时反复重启服务。
SETTINGS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "settings.json"

DEFAULT_SETTINGS: dict[str, Any] = {
    # 文本 LLM：是否启用 + 厂家 + 模型名（空串=厂家默认）
    "llm": {"enabled": True, "vendor": "dashscope", "model": ""},
    # 视觉模型（看图写文案）：当前仅 DashScope 可用
    "vision": {"vendor": "dashscope", "model": "qwen-vl-max"},
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
