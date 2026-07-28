"""LLM 客户端抽象与实现（工厂模式）。

设计目标：
- 接入「OpenAI 兼容」协议，厂家由设置中心运行时切换：base_url / api_key / model 均从设置读取，
  前端按各厂家官方文档预置（通义/DashScope、DeepSeek、Kimi、智谱 GLM、OpenAI、Ollama、自定义）。
- 结构化输出直接复用现有 Pydantic Schema（Agent 输出与 Java 落库契约不变）。
- 页面选什么厂家就走对应规则，**不降级、不偷偷借用其他卡片/`.env` 配置**：
  - 离线/规则模式（`LLM_ENABLED=false` 或 `llm.vendor="rule"`）：`get_llm_client()` 返回 None，
    Agent 显式走 `_rule_based_run` 确定性输出（这是用户/部署**显式选择**，不是隐式降级）。
  - 真实厂家模式：缺 API Key、端点不可达或构造失败 → 直接抛 `ConfigError`，由 API 层转成 422 报错。
- 设置变更后由 settings_store 调用 `reset()` 清缓存即时生效。
"""
from __future__ import annotations

import httpx
from abc import ABC, abstractmethod
from typing import Type

from pydantic import BaseModel

from app import config
from app.errors import ConfigError
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
        try:
            runnable = self._model.with_structured_output(schema)
            return runnable.invoke(
                [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ]
            )
        except ConfigError:
            # 配置类错误（缺 Key / 端点不可达）原样向上，由 API 层转成 422 中文报错。
            raise
        except Exception as e:  # noqa: BLE001
            # LLM 调用异常（模型不存在 / 401 / 结构化输出不支持 / 网络抖动等）：
            # 统一转成 ConfigError，避免裸 500 堆栈；由 API 层转成 422，前端弹窗提示。
            raise ConfigError(f"LLM 生成失败（模型 {self._model.model_name}）：{e}") from e


class StubClient(LLMClient):
    """测试用：按 schema 类型返回预设实例，不依赖真实 LLM。"""

    def __init__(self, factory) -> None:
        self._factory = factory

    def generate(self, system: str, user: str, schema: Type[BaseModel]) -> BaseModel:
        return self._factory(system, user, schema)


_client: LLMClient | None = None
_initialized = False

# 库存监控（线2 预警）专属客户端缓存：配置缺/错时返回 None（红线降级），不抛错。
_monitor_client: LLMClient | None = None
_monitor_initialized = False


def reset() -> None:
    """清缓存：设置变更后调用，使下次生成重新构造 client（应用新厂家/模型）。"""
    global _client, _initialized, _monitor_client, _monitor_initialized
    _client = None
    _initialized = False
    _monitor_client = None
    _monitor_initialized = False


def llm_mode() -> str:
    """当前 LLM 运行模式。

    - "offline"：`LLM_ENABLED=false`（部署级显式离线）或 `llm.vendor="rule"`（页面显式选规则），
      此时应使用确定性规则输出，不调用任何外部 LLM。
    - "vendor"：选中了某个真实厂家，按要求走该厂家；配置缺失则报错。
    """
    if not config.LLM_ENABLED:
        return "offline"
    settings = get_settings().get("llm", {}) or {}
    if (settings.get("vendor") or "dashscope").strip() == "rule":
        return "offline"
    return "vendor"


def _endpoint_reachable(base_url: str) -> bool:
    """快速探活 LLM 端点（短超时）。

    任何 HTTP 响应（含 401/403/404）都视为「主机可达」；仅连接/超时类错误
    视为「不可达」。用于在网络根本不通时**提前给出明确报错**（而非傻等
    LLM_TIMEOUT_MS 才失败），属于「直接报错」而非「降级」。
    """
    try:
        url = base_url.rstrip("/") + "/models"
        httpx.get(url, timeout=3.0, follow_redirects=True)
        return True
    except httpx.RequestError:
        return False


def get_llm_client() -> LLMClient | None:
    """返回全局 LLM 客户端。

    - 离线/规则模式：返回 None（调用方据此显式走规则输出，**不是**隐式降级）。
    - 真实厂家模式：构造 OpenAI 兼容客户端；缺 Key / 端点不可达 / 构造失败
      直接抛 `ConfigError`，由上层转成用户友好报错。
    """
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True

    # 离线/规则模式：不构造任何客户端，返回 None 让 Agent 走显式规则实现。
    if llm_mode() == "offline":
        _client = None
        return None

    settings = get_settings().get("llm", {}) or {}
    if not settings.get("enabled", True):
        # 页面显式关闭 LLM：视为离线/规则模式。
        _client = None
        return None

    # 页面设置是唯一配置来源（OpenAI 兼容协议）：直接读 base_url / api_key / model。
    base_url = (settings.get("base_url") or "").strip() or config.LLM_BASE_URL
    model = (settings.get("model") or "").strip() or config.LLM_MODEL
    vendor = (settings.get("vendor") or "dashscope").strip()
    api_key = (settings.get("api_key") or "").strip()

    # 未填 Key 的云端厂家 → 直接报错（不再静默降级到规则）。Ollama 本地无需真实 Key。
    if not api_key and vendor != "ollama":
        raise ConfigError(
            f"LLM 已选择厂家「{vendor}」但未填写 API Key，请在设置中心 LLM 卡片填写后重试。"
        )
    api_key = api_key or "ollama"

    # 端点不可达 → 直接报错（不静默降级）。
    if not _endpoint_reachable(base_url):
        raise ConfigError(f"LLM 端点不可达：{base_url}（请检查 base_url 或网络连通性）")

    try:
        _client = OpenAILikeClient(model=model, base_url=base_url, api_key=api_key)
    except Exception as e:  # noqa: BLE001
        raise ConfigError(f"LLM 客户端构造失败（厂家 {vendor}）：{e}") from e
    return _client


def get_monitor_llm_client() -> LLMClient | None:
    """返回「库存监控」专属 LLM 客户端（独立于全局 LLM 卡片）。

    - 监控卡片关闭 / 选规则 / 缺 Key（云端厂家）/ 端点不可达 / 构造失败
      → 一律返回 None，由 InventoryMonitorAgent 走红线降级（可售天数<5天预警），
      **不抛错、不卡页面**。
    - 仅当监控卡片启用且配置完整可用时才返回真实客户端，做未来事件智能判断。
    """
    global _monitor_client, _monitor_initialized
    if _monitor_initialized:
        return _monitor_client
    _monitor_initialized = True
    _monitor_client = _build_monitor_client()
    return _monitor_client


def _build_monitor_client() -> LLMClient | None:
    settings = get_settings().get("monitor", {}) or {}
    if not settings.get("enabled", False):
        return None
    vendor = (settings.get("vendor") or "dashscope").strip()
    if vendor == "rule":
        return None
    base_url = (settings.get("base_url") or "").strip()
    model = (settings.get("model") or "").strip()
    api_key = (settings.get("api_key") or "").strip()
    if not base_url:
        return None
    # 云端厂家缺 Key → 红线降级（不报错）。
    if not api_key and vendor != "ollama":
        return None
    api_key = api_key or "ollama"
    # 端点不可达 → 红线降级（避免傻等 LLM_TIMEOUT_MS 才失败）。
    if not _endpoint_reachable(base_url):
        return None
    try:
        return OpenAILikeClient(model=model, base_url=base_url, api_key=api_key)
    except Exception:  # noqa: BLE001
        return None
