"""Qdrant 向量存储 — embedder 生成向量,Qdrant 存储和检索。

Qdrant 是开源向量数据库,支持本地或云端部署。
本模块封装 Qdrant 的 AsyncQdrantClient,提供:
  - store() — 存储文本及其向量
  - search() — 语义搜索(按 session_id 过滤)
  - get_recent() — 按 session_id 获取最近的记录

集合名固定为 "memory_vectors",向量距离用 COSINE 余弦相似度。
"""
# os — 标准库,读取环境变量
import os
# datetime — 标准库,记录时间戳
# timezone, UTC — Python 3.11+ 推荐的时区表示
from datetime import datetime, timezone, UTC
# AsyncQdrantClient — Qdrant 的异步客户端
# models — Qdrant 的数据模型(VectorParams、PointStruct、Filter 等)
from qdrant_client import AsyncQdrantClient, models
# 从当前包导入 EmbeddingProvider 抽象基类,用于类型注解
from .embeddings import EmbeddingProvider

# Qdrant 服务地址 — 优先读环境变量,默认本地 6333
QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
# 集合名 — 所有记忆向量存于同一集合,通过 payload.session_id 区分会话
COLLECTION_NAME: str = "memory_vectors"


class QdrantVectorStore:
    """基于 Qdrant 的向量存储(本地或云端)。

    通过 EmbeddingProvider 生成向量,Qdrant 负责存储和相似度检索。
    每个 session 的记忆通过 payload.session_id 字段隔离。
    """

    def __init__(self, embedder: EmbeddingProvider) -> None:
        """初始化。

        Args:
            embedder: embedding 提供商实例,用于将文本转为向量
        """
        self.embedder = embedder
        # Qdrant 客户端(connect 时创建)
        self._client: AsyncQdrantClient | None = None
        # 是否已连接并就绪
        self._ready: bool = False

    # ------------------------------------------------------------------ lifecycle
    async def connect(self) -> None:
        """连接到 Qdrant 服务,并确保集合存在。"""
        self._client = AsyncQdrantClient(url=QDRANT_URL)
        # 确保集合存在(若不存在则创建,向量维度来自 embedder 探测)
        await self._ensure_collection()
        self._ready = True

    async def close(self) -> None:
        """关闭 Qdrant 客户端连接。"""
        if self._client:
            await self._client.close()
            self._client = None
            self._ready = False

    async def _ensure_collection(self) -> None:
        """确保 Qdrant 集合存在,不存在则创建。

        向量维度从 embedder.dimensions 获取,
        若 embedder 维度未知(如 Ollama 首次调用前),
        则通过 embed 一个占位文本触发维度检测。
        """
        if self._client is None:
            return
        # 探测维度
        try:
            dims = self.embedder.dimensions
        except RuntimeError:
            # Ollama 等 provider 在首次 embed 前维度未知,这里强制检测
            dummy = await self.embedder.embed(".")
            dims = len(dummy)
        # 检查集合是否存在,不存在则创建
        if not await self._client.collection_exists(COLLECTION_NAME):
            await self._client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=dims,                   # 向量维度
                    distance=models.Distance.COSINE,  # 余弦距离
                ),
            )

    # ------------------------------------------------------------------ store
    async def store(
        self, session_id: str, content: str, metadata: dict | None = None,
        *, api_key: str | None = None,
    ) -> str:
        """存储一条文本及其向量。

        Args:
            session_id: 会话 ID(用于隔离不同会话的记忆)
            content: 文本内容
            metadata: 可选元数据(如角色、长度等)
            api_key: embedding 调用使用的 API Key
        Returns:
            str: 生成的点 ID(UUID)
        """
        if self._client is None or not self._ready:
            raise RuntimeError("Vector store not connected")
        # 生成向量
        embedding = await self.embedder.embed(content, api_key=api_key)
        # 延迟导入 uuid,避免模块加载时引入
        import uuid
        # 生成唯一点 ID
        point_id = str(uuid.uuid4())
        # payload — 与向量一起存储的元数据
        payload: dict = {
            "session_id": session_id,            # 会话 ID(用于过滤)
            "content": content,                  # 原始文本
            "metadata": metadata or {},           # 额外元数据
            "created_at": datetime.now(UTC).isoformat(),  # 创建时间
        }
        # upsert — 插入或更新(point_id 已存在则覆盖)
        await self._client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            ],
        )
        return point_id

    # ----------------------------------------------------------------- search
    async def search(
        self, session_id: str, query: str, limit: int = 5, threshold: float = 0.7,
        *, api_key: str | None = None,
    ) -> list[dict]:
        """语义搜索:查找与 query 最相似的记忆。

        Args:
            session_id: 仅搜索该会话的记忆
            query: 查询文本
            limit: 返回最多多少条
            threshold: 相似度阈值(0~1),低于此值的结果不返回
            api_key: embedding 调用使用的 API Key
        Returns:
            list[dict]: 匹配结果列表,每项包含 id、content、similarity、created_at
        """
        if self._client is None or not self._ready:
            return []
        # 将查询文本转为向量
        embedding = await self.embedder.embed(query, api_key=api_key)
        # query_points — Qdrant 的向量检索 API
        results = await self._client.query_points(
            collection_name=COLLECTION_NAME,
            query=embedding,
            # 过滤条件:仅匹配当前 session_id
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="session_id",
                        match=models.MatchValue(value=session_id),
                    )
                ]
            ),
            limit=limit,
            score_threshold=threshold,  # 相似度阈值
        )
        # 转换为简化的字典列表返回
        return [
            {
                "id": str(p.id),
                "content": str(p.payload.get("content", "")) if p.payload else "",
                "similarity": round(p.score, 4),  # 保留 4 位小数
                "created_at": str(p.payload.get("created_at", "")) if p.payload else "",
            }
        for p in results.points
        ]

    # -------------------------------------------------------------- get_recent
    async def get_recent(
        self, session_id: str, limit: int = 10,
    ) -> list[dict]:
        """获取指定会话最近的记忆(按写入顺序,非相似度)。

        使用 Qdrant 的 scroll API 翻页读取,适用于"最近 N 条"场景。

        Args:
            session_id: 会话 ID
            limit: 返回最多多少条
        Returns:
            list[dict]: 最近记忆列表,每项含 id、content、created_at
        """
        if self._client is None or not self._ready:
            return []
        # scroll — 不做向量检索,仅按过滤条件翻页
        results = await self._client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="session_id",
                        match=models.MatchValue(value=session_id),
                    )
                ]
            ),
            limit=limit,
        )
        # results 是 (points, next_offset) 元组,这里只取 points
        points, _ = results
        return [
            {
                "id": str(p.id),
                "content": str(p.payload.get("content", "")) if p.payload else "",
                "created_at": str(p.payload.get("created_at", "")) if p.payload else "",
            }
            for p in points
        ]
