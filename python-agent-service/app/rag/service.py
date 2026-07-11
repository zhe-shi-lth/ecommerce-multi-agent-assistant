"""分类知识库检索服务：懒构建内存向量库，按类目检索并降级保护主链路。"""
import logging
from functools import lru_cache
from typing import Optional

import chromadb
from langchain_chroma import Chroma

from app import config
from app.rag.embeddings import get_embeddings
from app.rag.loader import KnowledgeLoader
from app.schemas.product import ProductContext

logger = logging.getLogger("rag")


class CategoryKnowledgeService:
    def __init__(self, embeddings=None) -> None:
        # embeddings 可注入（测试用 fake）；默认懒加载 Ollama
        self._embeddings = embeddings
        self._vectorstore: Optional[Chroma] = None
        self._built = False  # 是否已尝试构建
        self._disabled = False  # 构建失败/禁用 -> 永久降级为空检索

    def _ensure_built(self) -> None:
        if self._built or self._disabled:
            return
        self._built = True
        if not config.RAG_ENABLED:
            self._disabled = True
            return
        try:
            docs = KnowledgeLoader(
                config.RAG_KNOWLEDGE_PATH,
                chunk_size=config.RAG_CHUNK_SIZE,
                chunk_overlap=config.RAG_CHUNK_OVERLAP,
            ).load()
            if not docs:
                logger.warning("RAG: 知识库目录为空或无 .md，降级为空检索。")
                self._disabled = True
                return
            emb = self._embeddings or get_embeddings()
            client = chromadb.EphemeralClient()  # 强制纯内存
            self._vectorstore = Chroma.from_documents(
                documents=docs,
                embedding=emb,
                collection_name="category_knowledge",
                client=client,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("RAG: 构建向量库失败，降级为空检索：%s", exc)
            self._vectorstore = None
            self._disabled = True

    def retrieve(self, category: str, query: str, top_k: int | None = None) -> str:
        """按 category 元数据过滤，返回拼接的 chunk 文本；任何异常/禁用返回 ''。"""
        if not config.RAG_ENABLED:
            return ""
        self._ensure_built()
        if self._vectorstore is None:
            return ""
        try:
            top_k = top_k or config.RAG_TOP_K
            hits = self._vectorstore.similarity_search(
                query, k=top_k, filter={"category": category}
            )
            return "\n\n".join(d.page_content for d in hits)
        except Exception as exc:  # noqa: BLE001
            logger.warning("RAG: 检索失败，返回空：%s", exc)
            return ""

    def retrieve_for_product(self, product: ProductContext, top_k: int | None = None) -> str:
        query = " ".join(
            filter(None, [product.name, product.category, product.usage_scenario or ""])
        )
        return self.retrieve(product.category, query, top_k)


@lru_cache(maxsize=1)
def get_knowledge_service() -> CategoryKnowledgeService:
    return CategoryKnowledgeService()
