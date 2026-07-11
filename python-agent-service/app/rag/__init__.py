"""分类知识库 RAG：Markdown 知识加载、本地向量检索、Agent prompt 注入。"""
from app.rag.loader import KnowledgeLoader
from app.rag.service import CategoryKnowledgeService, get_knowledge_service

__all__ = ["KnowledgeLoader", "CategoryKnowledgeService", "get_knowledge_service"]
