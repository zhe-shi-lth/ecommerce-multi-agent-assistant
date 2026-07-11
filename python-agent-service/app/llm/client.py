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


def get_llm_client() -> LLMClient | None:
    """返回全局 LLM 客户端；LLM 禁用或初始化失败返回 None。"""
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
