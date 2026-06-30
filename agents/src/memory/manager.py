"""混合记忆管理器 — 滑动窗口(短期)+ pgvector/Qdrant(长期)。

每个会话维护一个内存中的滑动窗口,保留最近 N 轮对话用于即时上下文。
长期记忆持久化到 Qdrant 向量数据库,embedding 由 Ollama(本地)或
OpenAI(远程)生成,根据 worker 配置自动选择。

记忆构建逻辑(build_context):
  1. 从向量库检索与当前 query 语义相关的过往记忆(长期)
  2. 取滑动窗口中最近的若干轮对话(短期)
  3. 拼接为 SystemMessage 注入到 LLM 上下文
"""

class MemoryManager:
    """混合记忆管理器 — 短期滑动窗口 + 长期向量存储。

    Attributes:
        window_size: 滑动窗口大小(保留最近 N 轮对话)
        _turns: 内存中的会话历史 {session_id: [{"role":..., "content":...}]}
        _vector_store: 长期向量存储实例(None 表示禁用长期记忆)
        _embedder: embedding 提供商(与 _vector_store 配套)
        _connected: 向量存储是否已连接
    """

    def __init__(
        self,
        window_size: int = 24,
        vector_store = None,
        embedder = None,
    ) -> None:
        """初始化。

        Args:
            window_size: 滑动窗口大小,默认 24(即保留最近 24 轮)
            vector_store: 向量存储实例,None 时禁用长期记忆
            embedder: embedding 提供商(仅用于类型提示,实际由 vector_store 持有)
        """
        self.window_size = window_size
        # 短期记忆:session_id -> 对话列表
        self._turns: dict[str, list[dict]] = {}
        # 长期记忆后端
        self._vector_store = vector_store
        self._embedder = embedder
        self._connected = False

    # ------------------------------------------------------------------ lifecycle
    async def connect(self) -> None:
        """连接到向量存储(若可用)。"""
        if self._vector_store is not None and not self._connected:
            await self._vector_store.connect()
            self._connected = True

    async def close(self) -> None:
        """关闭向量存储连接。"""
        if self._vector_store is not None:
            await self._vector_store.close()
            self._connected = False

    # -------------------------------------------------------------- short-term
    def add_turn(self, session_id: str, role: str, content: str) -> None:
        """向短期滑动窗口添加一轮对话。

        超过 window_size 时,删除最旧的一轮(FIFO)。

        Args:
            session_id: 会话 ID
            role: "user" 或 "assistant"
            content: 消息内容
        """
        # setdefault — 若 session_id 不存在则初始化为空列表
        self._turns.setdefault(session_id, [])
        window = self._turns[session_id]
        # 追加本轮对话
        window.append({"role": role, "content": content})
        # 超长时删除最旧的一条
        if len(window) > self.window_size:
            del window[0]

    def get_history(self, session_id: str) -> list[dict]:
        """获取指定会话的完整短期历史(滑动窗口内的全部轮次)。

        Args:
            session_id: 会话 ID
        Returns:
            list[dict]: 对话列表,可能为空
        """
        return self._turns.get(session_id, [])

    # ------------------------------------------------------- context enrichment
    async def build_context(
        self, session_id: str, query: str, *, api_key: str | None = None,
    ) -> str:
        """构建注入 LLM 的记忆上下文。

        合并长期向量检索 + 短期滑动窗口,格式化为 Markdown 文本。
        若两者都为空,返回空字符串(不注入)。

        Args:
            session_id: 会话 ID
            query: 当前用户问题(用于语义检索)
            api_key: embedding 调用使用的 API Key
        Returns:
            str: 格式化的上下文文本,可能为空
        """
        parts: list[str] = []

        # ---- 长期向量检索 -----------------------------------------------
        long_term = await self.retrieve(session_id, query, api_key=api_key)
        if long_term:
            parts.append("## Related past memories")
            # 仅取前 5 条,每条截断到 500 字符
            for item in long_term[:5]:
                similarity = item.get("similarity", 0)
                parts.append(f"  [{similarity:.2f}] {item['content'][:500]}")
            parts.append("")

        # ---- 短期滑动窗口 -----------------------------------------------
        history = self.get_history(session_id)
        if history:
            parts.append("## Recent conversation")
        # 仅取最近 8 轮,每条截断到 400 字符
        for t in history[-8:]:
            parts.append(f"  {t['role']}: {t['content'][:400]}")

        # ---- 无任何记忆时返回空字符串 -----------------------------------
        if not parts:
            return ""
        return "\n".join(parts)

    async def retrieve(self, session_id: str, query: str,
                       *, api_key: str | None = None) -> list[dict]:
        """从向量存储检索相关的长期记忆。

        Args:
            session_id: 会话 ID
            query: 查询文本
            api_key: embedding 调用使用的 API Key
        Returns:
            list[dict]: 匹配的记忆列表,可能为空(向量存储不可用时返回 [])
        """
        if self._vector_store is None:
            return []
        try:
            return await self._vector_store.search(
                session_id, query, limit=5, api_key=api_key,
            )
        except Exception:
            # 任何异常都吞掉,避免影响主流程
            return []

    async def store_long_term(self, session_id: str, content: str,
                              meta: dict | None = None,
                              *, api_key: str | None = None) -> None:
        """将一条信息持久化到向量存储(长期记忆)。

        Args:
            session_id: 会话 ID
            content: 待存储的文本
            meta: 可选元数据
            api_key: embedding 调用使用的 API Key
        """
        if self._vector_store is None:
            return
        try:
            await self._vector_store.store(
                session_id, content, metadata=meta, api_key=api_key,
            )
        except Exception:
            # 异常静默,避免影响主流程
            pass

    async def finish_turn(self, session_id: str, user_msg: str, assistant_msg: str,
                          *, api_key: str | None = None) -> None:
        """完成一轮对话后,将完整 turn(user + assistant)写入长期记忆。

        Args:
            session_id: 会话 ID
            user_msg: 用户消息
            assistant_msg: 助手回复(超过 2000 字会截断)
            api_key: embedding 调用使用的 API Key
        """
        # 无向量存储或助手回复为空时不存储
        if self._vector_store is None or not assistant_msg:
            return
        # 拼接为一条记忆(assistant 部分截断到 2000 字)
        combined = f"User: {user_msg}\nAssistant: {assistant_msg[:2000]}"
        await self.store_long_term(
            session_id, combined,
            meta={"role": "turn", "user_length": len(user_msg), "assistant_length": len(assistant_msg)},
            api_key=api_key,
        )
