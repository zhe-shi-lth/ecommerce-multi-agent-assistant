"""读取知识库目录下的 Markdown 文件，按标题切块并附加类目元数据。"""
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

# 先按一级/二级标题分块，保留标题层级作为元数据
_HEADERS_TO_SPLIT_ON = [
    ("#", "h1"),
    ("##", "h2"),
]


class KnowledgeLoader:
    def __init__(
        self,
        knowledge_dir: str | Path,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
    ) -> None:
        self._dir = Path(knowledge_dir)
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap

    def load(self) -> list[Document]:
        """读取目录下所有 *.md，按文件名派生 category，返回带
        metadata={category, source_file} 的 Document 列表。目录缺失返回 []。"""
        if not self._dir.is_dir():
            return []

        header_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=_HEADERS_TO_SPLIT_ON
        )
        char_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._chunk_size, chunk_overlap=self._chunk_overlap
        )

        docs: list[Document] = []
        for path in sorted(self._dir.glob("*.md")):
            category = path.stem  # Home.md -> "Home"
            raw = path.read_text(encoding="utf-8")
            # 两段式：先按标题切，再对每段做长度切块
            header_splits = header_splitter.split_text(raw)
            for hs in header_splits:
                for chunk in char_splitter.split_documents([hs]):
                    chunk.metadata["category"] = category
                    chunk.metadata["source_file"] = path.name
                    docs.append(chunk)
        return docs
