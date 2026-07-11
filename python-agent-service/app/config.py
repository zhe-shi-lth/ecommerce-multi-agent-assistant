"""LLM 与运行相关配置，从环境变量读取（可用 .env 提供）。"""
import os

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _as_float(value: str | None, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


# LLM（OpenAI 兼容协议，默认指向本地 Ollama 的 /v1 端点）
LLM_ENABLED = _as_bool(os.getenv("LLM_ENABLED"), default=True)
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:latest")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")
LLM_TEMPERATURE = _as_float(os.getenv("LLM_TEMPERATURE"), 0.3)
LLM_TIMEOUT_MS = _as_int(os.getenv("LLM_TIMEOUT_MS"), 30000)
