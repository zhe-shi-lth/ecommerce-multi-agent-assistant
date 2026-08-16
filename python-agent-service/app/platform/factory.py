"""平台适配器工厂：按平台名构造适配器，凭证只来自设置中心 platform_api。"""
from __future__ import annotations

from typing import Any

from app.errors import ConfigError
from app.platform.base import PlatformAdapter
from app.platform.douyin import DouyinAdapter
from app.platform.taobao import TaobaoAdapter
from app.platform.xiaohongshu import XiaohongshuAdapter
import os
import httpx
from app.settings_store import PLATFORM_KEYS
from app.security import tenant_context

_ADAPTERS: dict[str, type[PlatformAdapter]] = {
    "taobao": TaobaoAdapter,
    "douyin": DouyinAdapter,
    "xiaohongshu": XiaohongshuAdapter,
}


def _store_credentials(platform: str) -> dict[str, Any]:
    context = tenant_context.get()
    if context is None:
        raise ConfigError("缺少企业/店铺上下文，请重新登录后再试")
    company_id, store_id = context
    url = f"{os.getenv('JAVA_SERVICE_BASE_URL', 'http://localhost:8080')}/api/store-platform-configs/internal/{platform}"
    try:
        response = httpx.get(url, headers={"X-Service-Key": os.getenv("SERVICE_API_KEY", "dev-service-key-change-me"), "X-Company-Id": str(company_id), "X-Store-Id": str(store_id)}, timeout=10)
        if response.status_code == 404:
            raise ConfigError("当前店铺未配置该平台凭证，请到设置中心填写")
        response.raise_for_status()
        return response.json()
    except ConfigError:
        raise
    except Exception as exc:
        raise ConfigError(f"读取当前店铺平台凭证失败：{exc}") from exc

def get_adapter(platform: str, settings: dict[str, Any] | None = None) -> PlatformAdapter:
    """按平台构造适配器；凭证只来自设置中心 platform_api，不读 .env。"""
    key = (platform or "").strip().lower()
    cls = _ADAPTERS.get(key)
    if cls is None:
        raise ConfigError(
            f"不支持的订单来源平台「{platform or '(空)'}」，当前支持：淘宝 / 抖音 / 小红书"
        )
    return cls(_store_credentials(key))


def configured_platforms(settings: dict[str, Any] | None = None) -> list[str]:
    """返回凭证已填齐、可用于真实拉单/复核的平台列表（供状态端点/前端提示）。"""
    out: list[str] = []
    for platform in PLATFORM_KEYS:
        try:
            _store_credentials(platform)
            out.append(platform)
        except ConfigError:
            pass
    return out
