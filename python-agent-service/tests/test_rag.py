"""分类知识库 RAG 单测：无需 Ollama，用本地确定性 fake embedding。"""
import hashlib

import chromadb
import pytest
from langchain_core.embeddings import Embeddings

from app.rag.loader import KnowledgeLoader
from app.rag.service import CategoryKnowledgeService
from app.schemas.product import ProductContext


class DeterministicFakeEmbeddings(Embeddings):
    """基于哈希的确定性向量，避免依赖 langchain_openai.FakeEmbeddings（不存在）。"""

    def __init__(self, dim: int = 32) -> None:
        self.dim = dim

    def _vec(self, text: str) -> list[float]:
        h = hashlib.sha256(text.encode()).digest()
        return [float((h[i % len(h)] - 128) / 128) for i in range(self.dim)]

    def embed_documents(self, texts):
        return [self._vec(t) for t in texts]

    def embed_query(self, text):
        return self._vec(text)


_HOME_MD = """# Home 运营知识库
## 平台规则
### 淘宝
- 标题核心词前置
## 违禁词
- 绝对化用语：最、第一
## SEO 建议
- 核心词：保温杯、便携水杯
"""

_BEAUTY_MD = """# Beauty 运营知识库
## 平台规则
### 小红书
- 重成分科普
## 违禁词
- 医疗用语：治疗、消炎
## SEO 建议
- 核心词：保湿、成分护肤
"""


def _write_kb(tmp_path):
    (tmp_path / "Home.md").write_text(_HOME_MD, encoding="utf-8")
    (tmp_path / "Beauty.md").write_text(_BEAUTY_MD, encoding="utf-8")


def test_loader_chunks_and_metadata(tmp_path):
    _write_kb(tmp_path)
    docs = KnowledgeLoader(tmp_path).load()
    assert len(docs) > 0
    categories = {d.metadata["category"] for d in docs}
    assert categories == {"Home", "Beauty"}
    for d in docs:
        assert d.metadata["source_file"] in {"Home.md", "Beauty.md"}


def test_retrieve_routes_by_category(tmp_path, monkeypatch):
    monkeypatch.setattr("app.rag.service.config.RAG_ENABLED", True)  # 测试封闭，不受本地 .env 关闭 RAG 影响
    _write_kb(tmp_path)
    docs = KnowledgeLoader(tmp_path).load()
    service = CategoryKnowledgeService(embeddings=DeterministicFakeEmbeddings())
    service._vectorstore = __import__(
        "langchain_chroma", fromlist=["Chroma"]
    ).Chroma.from_documents(
        documents=docs,
        embedding=DeterministicFakeEmbeddings(),
        collection_name="test_kb",
        client=chromadb.EphemeralClient(),  # 隔离，避免默认持久化 client 的残留缓存串味
    )
    service._built = True

    home_text = service.retrieve("Home", "保温 淘宝 违禁词")
    assert "保温杯" in home_text
    assert "治疗" not in home_text  # Beauty 内容不应混入

    beauty_text = service.retrieve("Beauty", "保湿 成分 小红书")
    assert "保湿" in beauty_text
    assert "保温杯" not in beauty_text


def test_retrieve_disabled(monkeypatch, tmp_path):
    monkeypatch.setattr("app.rag.service.config.RAG_ENABLED", False)
    service = CategoryKnowledgeService(embeddings=DeterministicFakeEmbeddings())
    assert service.retrieve("Home", "anything") == ""


def test_retrieve_for_product_uses_category(tmp_path, monkeypatch):
    monkeypatch.setattr("app.rag.service.config.RAG_ENABLED", True)  # 测试封闭，不受本地 .env 关闭 RAG 影响
    _write_kb(tmp_path)
    docs = KnowledgeLoader(tmp_path).load()
    service = CategoryKnowledgeService(embeddings=DeterministicFakeEmbeddings())
    service._vectorstore = __import__(
        "langchain_chroma", fromlist=["Chroma"]
    ).Chroma.from_documents(
        documents=docs,
        embedding=DeterministicFakeEmbeddings(),
        collection_name="test_kb2",
        client=chromadb.EphemeralClient(),  # 隔离，避免默认持久化 client 的残留缓存串味
    )
    service._built = True

    product = ProductContext(
        product_id=1,
        name="保温杯",
        category="Home",
        description="不锈钢保温杯",
        cost_price=20,
        sale_price=59,
        usage_scenario="办公室",
        status="ACTIVE",
    )
    text = service.retrieve_for_product(product)
    assert "保温杯" in text


def test_build_failure_degrades(monkeypatch, tmp_path):
    _write_kb(tmp_path)
    monkeypatch.setattr(
        "app.rag.service.get_embeddings",
        lambda: (_ for _ in ()).throw(RuntimeError("embeddings down")),
    )
    service = CategoryKnowledgeService()
    service._ensure_built()
    assert service._disabled is True
    assert service.retrieve("Home", "anything") == ""
