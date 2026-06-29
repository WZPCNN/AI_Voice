"""Embedding 提供商 — OpenAI(远程)和 Ollama(本地,通过 langchain-ollama >= 1.2)。

提供统一的 EmbeddingProvider 抽象基类,
以及两个具体实现:
  - OpenAIEmbeddingProvider:调用 OpenAI text-embedding-3-small API
  - LangchainOllamaEmbeddingProvider:调用本地 Ollama embedding 模型

凭据(api_key)按请求注入,确保多用户场景下使用各自的 API Key。
"""
# asyncio — 标准库,用于将同步调用包装为异步(asyncio.to_thread)
import asyncio
# os — 标准库,读取环境变量作为兜底配置
import os
# ABC + abstractmethod — 抽象基类支持,定义接口规范
from abc import ABC, abstractmethod
# OpenAI — OpenAI 官方 Python SDK,用于调用 embedding API
from openai import OpenAI
# OllamaEmbeddings — langchain-ollama 提供的 Ollama embedding 适配器
from langchain_ollama import OllamaEmbeddings


class EmbeddingProvider(ABC):
    """Embedding 提供商抽象基类。

    所有具体提供商必须实现 embed 和 embed_batch 两个异步方法。
    """

    @abstractmethod
    async def embed(self, text: str, *, api_key: str | None = None) -> list[float]:
        """将单个文本转为向量。

        Args:
            text: 待嵌入的文本
            api_key: 可选 API Key(用于按请求注入凭据)

        Returns:
            list[float]: 向量(维度由具体实现决定)
        """
        ...

    @abstractmethod
    async def embed_batch(self, texts: list[str], *, api_key: str | None = None) -> list[list[float]]:
        """批量将文本转为向量(比循环调用 embed 更高效)。

        Args:
            texts: 待嵌入的文本列表
            api_key: 可选 API Key

        Returns:
            list[list[float]]: 向量列表,与输入文本一一对应
        """
        ...


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI text-embedding-3-small 提供商。

    OpenAI client 在首次调用时按 per-request 的 ``api_key`` 创建,
    若未传入则回退到 ``OPENAI_API_KEY`` 环境变量。
    会缓存 client 直到 api_key 变化(避免重复创建)。
    """

    def __init__(self, model: str = "text-embedding-3-small") -> None:
        """初始化。

        Args:
            model: OpenAI embedding 模型名,默认 text-embedding-3-small
        """
        # 延迟初始化的 OpenAI client(None 表示尚未创建)
        self._client: OpenAI | None = None
        # 当前 client 使用的 api_key(用于检测变化,触发重建)
        self._client_key: str | None = None
        # 模型名
        self.model = model
        # 向量维度(OpenAI text-embedding-3-small 固定 1536 维)
        self.dimensions = 1536

    def _get_client(self, api_key: str | None = None) -> OpenAI:
        """获取或创建 OpenAI client。

        若 api_key 与缓存的不一致,则重建 client。
        Args:
            api_key: 可选 API Key
        Returns:
            OpenAI: 客户端实例
        Raises:
            ValueError: 既无 api_key 也无 OPENAI_API_KEY 环境变量
        """
        # api_key 优先级:参数 > 环境变量
        key = api_key or os.getenv("OPENAI_API_KEY")
        if key is None:
            raise ValueError(
                "No API key available — configure one in Settings or set OPENAI_API_KEY"
            )
        # 若 client 不存在或 key 变化,则(重新)创建
        if self._client is None or self._client_key != key:
            self._client = OpenAI(api_key=key)
            self._client_key = key
        return self._client

    async def embed(self, text: str, *, api_key: str | None = None) -> list[float]:
        """将单个文本转为向量。

        Args:
            text: 待嵌入文本
            api_key: 可选 API Key
        Returns:
            list[float]: 1536 维向量
        """
        client = self._get_client(api_key)
        # asyncio.to_thread — 将同步的 OpenAI SDK 调用包装为异步
        # 避免阻塞事件循环
        resp = await asyncio.to_thread(client.embeddings.create, model=self.model, input=text)
        # resp.data 是列表,取第一个(因为只嵌入了一个文本)
        return resp.data[0].embedding

    async def embed_batch(self, texts: list[str], *, api_key: str | None = None) -> list[list[float]]:
        """批量嵌入文本。

        OpenAI API 支持单次请求处理多个输入,比循环 embed 更高效。

        Args:
            texts: 文本列表
            api_key: 可选 API Key
        Returns:
            list[list[float]]: 向量列表,顺序与输入一致
        """
        client = self._get_client(api_key)
        # 一次性传入所有文本
        resp = await asyncio.to_thread(client.embeddings.create, model=self.model, input=texts)
        # 按 resp.data 中的顺序提取 embedding
        return [item.embedding for item in resp.data]


class LangchainOllamaEmbeddingProvider(EmbeddingProvider):
    """基于 langchain-ollama >= 1.1 的 Ollama embedding 提供商。

    向量维度在首次 ``embed`` 调用时通过测量返回向量长度自动检测
    (因为不同 Ollama embedding 模型维度不同,如 nomic-embed-text 是 768,
    qwen3-embedding:8b 是 4096)。

    使用 ``aembed_query`` / ``aembed_documents`` 异步 API
    (langchain-ollama 1.1 引入)。
    """

    def __init__(
        self,
        model: str | None = None,
        base_url: str | None = None,
    ) -> None:
        """初始化 Ollama embedding。

        Args:
            model: Ollama embedding 模型名,None 时读环境变量 OLLAMA_EMBED_MODEL,
                   再无则默认 "qwen3-embedding:8b"
            base_url: Ollama 服务地址,None 时读环境变量 OLLAMA_BASE_URL,
                      再无则默认 "http://localhost:11434"
        """
        # 模型名:参数 > 环境变量 > 默认值
        self.model = model or os.getenv("OLLAMA_EMBED_MODEL", "qwen3-embedding:8b")
        # base_url:参数 > 环境变量 > 默认值,.rstrip("/") 去除末尾斜杠保证拼接一致
        _base = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        # 创建 langchain-ollama 的 OllamaEmbeddings 实例
        self._embeddings = OllamaEmbeddings(model=self.model, base_url=_base)
        # 维度未知,首次 embed 后才填充
        self._dimensions: int | None = None

    @property
    def dimensions(self) -> int:
        """返回向量维度。

        Returns:
            int: 维度数,如 4096
        Raises:
            RuntimeError: 尚未调用过 embed(),维度未知
        """
        if self._dimensions is None:
            raise RuntimeError("Dimension not yet known — call embed() first")
        return self._dimensions

    async def embed(self, text: str, *, api_key: str | None = None) -> list[float]:
        """将单个文本转为向量。

        Args:
            text: 待嵌入文本
            api_key: 不使用(Ollama 本地服务无需凭据),仅为接口一致性保留
        Returns:
            list[float]: 向量
        """
        # 复用 embed_batch 实现单文本嵌入
        vectors = await self.embed_batch([text], api_key=api_key)
        return vectors[0]

    async def embed_batch(self, texts: list[str], *, api_key: str | None = None) -> list[list[float]]:
        """批量嵌入文本。

        Args:
            texts: 文本列表
            api_key: 不使用
        Returns:
            list[list[float]]: 向量列表
        """
        # 调用 langchain-ollama 的异步批量嵌入 API
        vectors: list[list[float]] = await self._embeddings.aembed_documents(texts)
        # 首次调用时自动检测维度
        if self._dimensions is None and vectors:
            self._dimensions = len(vectors[0])
        return vectors

    async def close(self) -> None:
        """关闭资源(空操作)。

        langchain-ollama 没有持久化连接池,无需显式关闭。
        仅为接口一致性保留。
        """
