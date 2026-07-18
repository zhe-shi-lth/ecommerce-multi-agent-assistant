"""LLM 与运行相关配置，从环境变量读取（可用 .env 提供）。"""
import os
from pathlib import Path

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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# RAG：本地向量知识库（可选；关闭或失败则链路退化为无知识库）
RAG_ENABLED = _as_bool(os.getenv("RAG_ENABLED"), default=True)
RAG_KNOWLEDGE_DIR = os.getenv("RAG_KNOWLEDGE_DIR", "knowledge")
RAG_EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "nomic-embed-text")
RAG_EMBEDDING_BASE_URL = os.getenv("RAG_EMBEDDING_BASE_URL", LLM_BASE_URL)
RAG_TOP_K = _as_int(os.getenv("RAG_TOP_K"), 3)
RAG_CHUNK_SIZE = _as_int(os.getenv("RAG_CHUNK_SIZE"), 500)
RAG_CHUNK_OVERLAP = _as_int(os.getenv("RAG_CHUNK_OVERLAP"), 50)

# 图片视觉审核（可选；复用本地 LLM 对图片创意方案做合规/质量审核）
IMAGE_REVIEW_ENABLED = _as_bool(os.getenv("IMAGE_REVIEW_ENABLED"), default=True)

# 通义万相（DashScope）文生图（可选；需 DASHSCOPE_API_KEY 且安装 dashscope SDK）
# 关闭或失败则图片步骤只出提示词占位，不阻断上架链路。
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
IMAGE_GEN_ENABLED = _as_bool(os.getenv("IMAGE_GEN_ENABLED"), default=False)
# 通义千问视觉模型（看图写文案用），与文生图共用 DASHSCOPE_API_KEY
DASHSCOPE_VL_MODEL = os.getenv("DASHSCOPE_VL_MODEL", "qwen-vl-max")

# 知识库目录相对 python-agent-service/ 解析（Windows 安全，规避 cwd 漂移）
BASE_DIR = Path(__file__).resolve().parents[1]
RAG_KNOWLEDGE_PATH = (
    BASE_DIR / RAG_KNOWLEDGE_DIR
    if not Path(RAG_KNOWLEDGE_DIR).is_absolute()
    else Path(RAG_KNOWLEDGE_DIR)
)
