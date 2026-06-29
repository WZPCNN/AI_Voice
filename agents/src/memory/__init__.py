"""Memory 模块 — 滑动窗口 + 可选向量存储(带 embedding)。

本包提供混合记忆系统:
  - 短期记忆:内存中的滑动窗口(MemoryManager)
  - 长期记忆:Qdrant 向量存储(QdrantVectorStore)+ embedding(EmbeddingProvider)

子模块:
  - manager.MemoryManager — 统一记忆管理入口
  - embeddings.* — embedding 提供商(OpenAI / Ollama)
  - vector_store.QdrantVectorStore — Qdrant 向量存储后端
"""
# 从 manager 模块导入 MemoryManager — 混合记忆管理器
from .manager import MemoryManager
# 从 embeddings 模块导入 embedding 相关类:
#   EmbeddingProvider — 抽象基类
#   OpenAIEmbeddingProvider — OpenAI 远程 embedding
#   LangchainOllamaEmbeddingProvider — Ollama 本地 embedding
from .embeddings import EmbeddingProvider, OpenAIEmbeddingProvider, LangchainOllamaEmbeddingProvider
# 从 vector_store 模块导入 QdrantVectorStore — Qdrant 向量存储
from .vector_store import QdrantVectorStore

# __all__ — 显式声明模块的公开接口
# from memory import * 时只会导入这些名称
__all__ = ["MemoryManager", "EmbeddingProvider", "OpenAIEmbeddingProvider", "LangchainOllamaEmbeddingProvider", "QdrantVectorStore"]
