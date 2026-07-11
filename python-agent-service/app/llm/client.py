"""LLM 客户端抽象与实现。

设计目标：
- 用一套 OpenAI 兼容接口接入本地 Ollama（默认 base_url=http://localhost:11434/v1），
  未来切到 DeepSeek / OpenAI 等只需改配置。
- 结构化输出直接复用现有 Pydantic Schema（Agent 输出与 Java 落库契约不变）。
- `get_llm_client()` 按配置返回 client；禁用或构造失败返回 None，Agent 自动走规则 fallback。
"""
from abc import ABC, abstractmethod
from typing import Type

from pydantic import BaseModel

from app import config


class LLMClient(ABC):
    @abstractmethod
    def generate(self, system: str, user: str, schema: Type[BaseModel]) -> BaseModel:
        """调用 LLM 并解析为给定 Pydantic Schema 的实例。失败时抛出异常。"""
        raise NotImplementedError


class OpenAILikeClient(LLMClient):
    """基于 langchain-openai 的 ChatOpenAI，指向任意 OpenAI 兼容端点（含 Ollama）。"""

    def __init__(self) -> None:
        from langchain_openai import ChatOpenAI

        self._model = ChatOpenAI(
            model=config.LLM_MODEL,
            base_url=config.LLM_BASE_URL,
            api_key=config.LLM_API_KEY,
            temperature=config.LLM_TEMPERATURE,
            timeout=config.LLM_TIMEOUT_MS / 1000.0,
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


_client: LLMClient | None = None
_initialized = False


def _endpoint_reachable() -> bool:
    """快速探活 LLM 端点（短超时）。

    任何 HTTP 响应（含 401/403/404）都视为「主机可达」；仅连接/超时类错误
    视为「不可用」。这样 Ollama 未启动时可立刻降级到规则实现，而不是每个
    Agent 都傻等 LLM_TIMEOUT_MS 才失败（避免整条生成链路被拖垮）。
    """
    import httpx

    try:
        url = config.LLM_BASE_URL.rstrip("/") + "/models"
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
    if not config.LLM_ENABLED:
        _client = None
        return None
    try:
        _client = OpenAILikeClient()
    except Exception:
        # 构造失败（如依赖缺失）不阻断服务，Agent 走规则 fallback。
        _client = None
        return _client
    # 端点不可达则直接降级，避免每次生成傻等 LLM_TIMEOUT_MS。
    if not _endpoint_reachable():
        _client = None
    return _client
