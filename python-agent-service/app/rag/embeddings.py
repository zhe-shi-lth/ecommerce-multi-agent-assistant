"""嵌入模型工厂：指向本地 Ollama 的 OpenAI 兼容 /v1/embeddings 端点。"""
from langchain_openai import OpenAIEmbeddings

from app import config


def get_embeddings() -> OpenAIEmbeddings:
    """复用 OpenAI 兼容协议调用 Ollama embeddings（默认模型 nomic-embed-text）。

    构造时不触网，仅 embed_documents/embed_query 才请求 /v1/embeddings。
    """
    return OpenAIEmbeddings(
        model=config.RAG_EMBEDDING_MODEL,
        base_url=config.RAG_EMBEDDING_BASE_URL,
        api_key=config.LLM_API_KEY,  # Ollama 填任意值即可，复用 "ollama"
        max_retries=1,
    )
