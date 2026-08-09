"""平台适配器工厂：按平台名构造适配器，凭证只来自设置中心 platform_api。"""
from __future__ import annotations

from typing import Any

from app.errors import ConfigError
from app.platform.base import PlatformAdapter
from app.platform.douyin import DouyinAdapter
from app.platform.taobao import TaobaoAdapter
from app.platform.xiaohongshu import XiaohongshuAdapter
from app.settings_store import PLATFORM_KEYS, get_settings, resolve_platform_credentials

_ADAPTERS: dict[str, type[PlatformAdapter]] = {
    "taobao": TaobaoAdapter,
    "douyin": DouyinAdapter,
    "xiaohongshu": XiaohongshuAdapter,
}


def get_adapter(platform: str, settings: dict[str, Any] | None = None) -> PlatformAdapter:
    """按平台构造适配器；凭证只来自设置中心 platform_api，不读 .env。"""
    key = (platform or "").strip().lower()
    cls = _ADAPTERS.get(key)
    if cls is None:
        raise ConfigError(
            f"不支持的订单来源平台「{platform or '(空)'}」，当前支持：淘宝 / 抖音 / 小红书"
        )
    return cls(resolve_platform_credentials(key, settings))


def configured_platforms(settings: dict[str, Any] | None = None) -> list[str]:
    """返回凭证已填齐、可用于真实拉单/复核的平台列表（供状态端点/前端提示）。"""
    s = settings or get_settings()
    pa = s.get("platform_api", {}) or {}
    out: list[str] = []
    for p in PLATFORM_KEYS:
        b = pa.get(p, {}) or {}
        if b.get("enabled") and b.get("app_key") and b.get("app_secret") and b.get("access_token"):
            out.append(p)
    return out
