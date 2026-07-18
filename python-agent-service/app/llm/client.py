"""LLM 客户端抽象与实现。

设计目标：
- 厂家经设置中心运行时切换：dashscope / ollama / openai（凭证仍走 .env，不进 UI）。
- 结构化输出直接复用现有 Pydantic Schema（Agent 输出与 Java 落库契约不变）。
- `get_llm_client()` 按运行时设置返回 client；禁用、构造失败或端点不可达时返回 None，
  Agent 自动走规则 fallback。设置变更后由 settings_store 调用 reset() 清缓存即时生效。
"""
from __future__ import annotations

import httpx
from abc import ABC, abstractmethod
from typing import Type

from pydantic import BaseModel

from app import config
from app.settings_store import get_settings


class LLMClient(ABC):
    @abstractmethod
    def generate(self, system: str, user: str, schema: Type[BaseModel]) -> BaseModel:
        """调用 LLM 并解析为给定 Pydantic Schema 的实例。失败时抛出异常。"""
        raise NotImplementedError


class OpenAILikeClient(LLMClient):
    """基于 langchain-openai 的 ChatOpenAI，指向任意 OpenAI 兼容端点（含 Ollama / DashScope）。"""

    def __init__(
        self,
        model: str,
        base_url: str,
        api_key: str,
        temperature: float | None = None,
        timeout_ms: int | None = None,
    ) -> None:
        from langchain_openai import ChatOpenAI

        self._model = ChatOpenAI(
            model=model,
            base_url=base_url,
            api_key=api_key,
            temperature=temperature if temperature is not None else config.LLM_TEMPERATURE,
            timeout=(timeout_ms if timeout_ms is not None else config.LLM_TIMEOUT_MS) / 1000.0,
            max_retries=1,
        )

    def generate(self, system: str, user: str, schema: Type[BaseModel]) -> BaseModel:
        runnable = self._model.with_structured_output(schema)
        return runnable.invoke(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        )


class StubClient(LLMClient):
    """测试用：按 schema 类型返回预设实例，不依赖真实 LLM。"""

    def __init__(self, factory) -> None:
        self._factory = factory

    def generate(self, system: str, user: str, schema: Type[BaseModel]) -> BaseModel:
        return self._factory(system, user, schema)


# 厂家 -> (base_url, api_key, 默认模型)。凭证来自 .env，不进设置/UI。
_VENDOR_ENDPOINTS = {
    "dashscope": (
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
        config.DASHSCOPE_API_KEY,
        "qwen-plus",
    ),
    "ollama": (config.LLM_BASE_URL, config.LLM_API_KEY, "qwen2.5:latest"),
    "openai": ("https://api.openai.com/v1", config.OPENAI_API_KEY, "gpt-4o-mini"),
}


def _resolve_vendor(vendor: str):
    return _VENDOR_ENDPOINTS.get(vendor) or _VENDOR_ENDPOINTS["ollama"]


_client: LLMClient | None = None
_initialized = False


def reset() -> None:
    """清缓存：设置变更后调用，使下次生成重新构造 client（应用新厂家/模型）。"""
    global _client, _initialized
    _client = None
    _initialized = False


def _endpoint_reachable(base_url: str) -> bool:
    """快速探活 LLM 端点（短超时）。

    任何 HTTP 响应（含 401/403/404）都视为「主机可达」；仅连接/超时类错误
    视为「不可用」。这样 Ollama 未启动时可立刻降级到规则实现，而不是每个
    Agent 都傻等 LLM_TIMEOUT_MS 才失败（避免整条生成链路被拖垮）。
    """
    try:
        url = base_url.rstrip("/") + "/models"
        httpx.get(url, timeout=3.0, follow_redirects=True)
        return True
    except httpx.RequestError:
        return False


def get_llm_client() -> LLMClient | None:
    """返回全局 LLM 客户端；LLM 禁用、构造失败或端点不可达时返回 None（走规则 fallback）。"""
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True

    # 部署级主开关（环境变量）：显式关闭时强制规则路径，UI 运行时设置无法覆盖。
    # 这样 Docker 以 LLM_ENABLED=false 启动可稳定跑规则模式，测试也默认走规则。
    if not config.LLM_ENABLED:
        _client = None
        return None

    settings = get_settings().get("llm", {})
    if not settings.get("enabled", True):
        _client = None
        return None

    vendor = settings.get("vendor", "dashscope")
    base_url, api_key, default_model = _resolve_vendor(vendor)
    model = settings.get("model") or default_model

    try:
        _client = OpenAILikeClient(model=model, base_url=base_url, api_key=api_key)
    except Exception:
        # 构造失败（如依赖缺失）不阻断服务，Agent 走规则 fallback。
        _client = None
        return _client
    # 端点不可达则直接降级，避免每次生成傻等 LLM_TIMEOUT_MS。
    if not _endpoint_reachable(base_url):
        _client = None
    return _client
