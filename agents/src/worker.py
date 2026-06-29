"""Redis Worker — 监听 agent 请求,流式返回响应。

支持五种模式:
  - exec:ReAct 单智能体模式(runner.run)
  - plan:Plan-Act-Reflect 模式(PlanExecutor)
  - multi:多智能体编排模式(MultiAgentOrchestrator)
  - skills:技能模式(按 skill_id 查询专属提示词和工具集)
  - mcp:MCP 工具模式(连接用户配置的 MCP 服务器,发现并注入外部工具)

所有 LLM/embedding 凭据来自请求消息,经调用链向下传递。
环境变量仅作最后兜底。
Worker 启动时无需任何 API Key —— 凭据按请求注入,
来自用户在设置页选择的数据库配置。

架构:
  API Server(NestJS) --Redis--> Worker(Python) --Redis--> API Server --SSE--> 前端

通信流程:
  1. API Server 将请求 push 到 agent:request:list
  2. Worker blpop 获取请求,创建任务处理
  3. Worker 将响应 chunk rpush 到 agent:response:list:<session_id>
  4. API Server blpop 获取响应,通过 SSE 转发给前端
"""
# json — 标准库,JSON 序列化
import json
# asyncio — 标准库,异步 IO
import asyncio
# os — 标准库,读取环境变量
import os
# Redis — redis-py 的异步客户端
from redis.asyncio import Redis
# AgentRunner — ReAct Agent 运行器
from runner import AgentRunner
# get_skill_by_id — 按 ID 查询内置技能(skills 模式用)
from skills import get_skill_by_id
# McpClientManager — MCP 客户端管理器(mcp 模式用)
from mcp_client import McpClientManager
# compose_system_prompt — 系统提示词组合函数(mcp 模式用)
from prompts import compose_system_prompt
# MemoryManager — 混合记忆管理器
from memory.manager import MemoryManager
# LangchainOllamaEmbeddingProvider — Ollama embedding 提供商
from memory.embeddings import LangchainOllamaEmbeddingProvider
# QdrantVectorStore — Qdrant 向量存储
from memory.vector_store import QdrantVectorStore
# PlanExecutor — Plan 模式执行器
from executor import PlanExecutor
# MultiAgentOrchestrator — multi 模式编排器(别名 DeepAgentOrchestrator)
from orchestrator import MultiAgentOrchestrator as DeepAgentOrchestrator
# get_logger / configure_logging — structlog 结构化日志(替代裸 print)
from logger import get_logger, configure_logging

# ── 模块级 logger ──────────────────────────────────────────────────────────
# 全局 logger 实例,绑定模块名 __name__,供本文件所有日志调用使用
logger = get_logger(__name__)

# ── Redis 配置 ────────────────────────────────────────────────────────────
# Redis 连接 URL — 优先读环境变量,默认本地 6379
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
# 请求通道 — API Server 将请求 push 到此列表
REQUEST_CHANNEL: str = "agent:request:list"

# ── MCP 模式专用系统提示词 ──────────────────────────────────────────────────
# mcp 模式下,Agent 可调用用户配置的外部 MCP 工具服务器提供的工具
_MCP_SYSTEM_PROMPT: str = compose_system_prompt(
    intro="你是 MCP 工具助手,可以调用用户配置的外部工具服务器提供的工具。",
    capabilities=(
        "## 核心能力\n"
        "- 调用用户配置的 MCP 服务器提供的工具\n"
        "- 自动发现可用工具并理解其参数 schema\n"
        "- 根据用户需求选择合适的工具并调用\n"
        "- 将工具返回结果整合到最终回复中"
    ),
    tool_guide=(
        "## 工具使用流程\n"
        "1. 分析用户需求,判断是否需要调用工具\n"
        "2. 若需要,选择合适的工具并构造参数\n"
        "3. 调用工具,观察返回结果\n"
        "4. 基于结果继续思考或给出最终回复\n"
        "5. 若无合适工具,基于自身知识直接回答"
    ),
)


class AgentWorker:
    """主 Worker — 订阅 Redis,分发 agent 请求。"""

    def __init__(self) -> None:
        """初始化 Worker。

        创建两个 Redis 连接(订阅和发布分离,避免阻塞),
        以及记忆系统(embedder + vector_store + manager)。
        """
        # 首个 chunk 是否已打印(调试用,每个 session 仅打印一次)
        self._first_chunk_printed = False
        # 订阅用 Redis 连接(decode_responses=True 自动解码为字符串)
        self.redis = Redis.from_url(REDIS_URL, decode_responses=True)
        # 发布用 Redis 连接(独立连接,避免订阅阻塞影响发布)
        self._publisher = Redis.from_url(REDIS_URL, decode_responses=True)
        # embedding 提供商(Ollama 本地)
        self._embedder = LangchainOllamaEmbeddingProvider()
        # 向量存储(Qdrant + embedder)
        self._vector_store = QdrantVectorStore(self._embedder)
        # 记忆管理器(短期窗口 + 长期向量)
        self.memory = MemoryManager(vector_store=self._vector_store, embedder=self._embedder)
        # 是否已启动(避免重复初始化)
        self._started: bool = False
        # 运行中的任务映射 {session_id: asyncio.Task}(用于取消)
        self._running_tasks: dict[str, asyncio.Task] = {}

    # ------------------------------------------------------------------ runner
    def _make_runner(self, **kw: object) -> AgentRunner:
        """根据请求参数创建 AgentRunner 实例。

        Args:
            kw: 关键字参数,包含 provider、model、temperature、api_key、base_url、
                tool_names(内置工具名列表)、tools(显式工具对象列表,mcp 模式用)

        Returns:
            AgentRunner: 配置好的运行器实例
        """
        return AgentRunner(
            model_provider=str(kw.get("provider", "openai")),
            model_name=str(kw.get("model", "gpt-4o")),
            # tool_names — 按名称筛选内置工具(skills 模式用)
            tool_names=kw.get("tool_names") if isinstance(kw.get("tool_names"), list) else None,
            # tools — 显式传入工具对象列表(mcp 模式用,优先级高于 tool_names)
            tools=kw.get("tools") if isinstance(kw.get("tools"), list) else None,
            temperature=float(kw.get("temperature", 0.7)),
            # 共享记忆管理器(所有会话共用)
            memory_manager=self.memory,
            # api_key / base_url 可为空字符串,用 or None 转换
            api_key=kw.get("api_key") or None,  # type: ignore[arg-type]
            base_url=kw.get("base_url") or None,  # type: ignore[arg-type]
        )

    # --------------------------------------------------------------- lifecycle
    async def start(self) -> None:
        """启动 Worker:连接向量存储。

        若 Qdrant 不可用,降级为纯内存模式(仅短期窗口,无长期记忆)。
        """
        try:
            await self.memory.connect()
            logger.info("vector_store_connected", embedder=self._embedder.model)
        except Exception as exc:
            # Qdrant 不可用时降级:仅短期记忆,无长期记忆
            logger.warning("vector_store_unavailable_fallback_in_memory", error=str(exc), exc_info=True)
            self.memory = MemoryManager(window_size=24, vector_store=None, embedder=None)
        self._started = True

    # ----------------------------------------------------------- handle request
    async def handle_request(self, message: dict) -> None:
        """处理单个 agent 请求。

        从 message 提取参数,根据 mode 选择执行方式,
        将响应 chunk 流式 push 到 Redis 响应列表。

        Args:
            message: 请求消息字典,包含:
                - session_id: 会话 ID
                - content: 用户消息
                - mode: "exec" | "plan" | "multi" | "skills" | "mcp"
                - provider: 模型提供商
                - model: 模型名
                - temperature: 采样温度
                - images: 图片列表
                - history: 历史对话
                - api_key: API Key
                - base_url: 自定义 base URL
                - skill: 技能 ID(skills 模式必填)
                - mcp_servers: MCP 服务器配置列表(mcp 模式必填)
        """
        logger.info("handle_request_called", keys=list(message.keys()))
        # ── 提取请求参数 ──────────────────────────────────────────────
        session_id: str = message.get("session_id", "default")
        content: str = message.get("content", "")
        mode: str = message.get("mode", "exec")
        provider: str = message.get("provider", "openai")
        model: str = message.get("model", "gpt-4o")
        temperature: float = float(message.get("temperature", 0.7))
        images: list[str] = message.get("images", [])
        history: list[dict] = message.get("history", [])
        api_key: str | None = message.get("api_key") or None
        base_url: str | None = message.get("base_url") or None
        # skills 模式:技能 ID(如 "code-review")
        skill_id: str = message.get("skill", "")
        # mcp 模式:用户活跃的 MCP 服务器配置列表
        mcp_servers: list[dict] = message.get("mcp_servers", [])
        # 响应列表 key — API Server 按 session_id 轮询此列表
        response_list: str = f"agent:response:list:{session_id}"

        try:
            logger.info("processing_session", session_id=session_id, mode=mode, provider=provider, model=model)

            # 记录用户消息到短期记忆
            self.memory.add_turn(session_id, "user", content)
            # 累积完整响应文本(用于长期记忆)
            full_response: str = ""

            # ── 注册当前任务,支持取消 ────────────────────────────────
            current_task = asyncio.current_task()
            if current_task is not None:
                self._running_tasks[session_id] = current_task

            # ── 根据模式选择执行方式 ──────────────────────────────────
            if mode == "multi":
                # 多智能体编排模式
                runner = self._make_runner(
                    provider=provider, model=model, temperature=temperature,
                    api_key=api_key, base_url=base_url,
                )
                logger.info("starting_multi_agent_mode", session_id=session_id)
                orchestrator = DeepAgentOrchestrator(runner)
                chunks = orchestrator.execute(session_id, content, history)
                logger.info("multi_agent_orchestrator_created")
            elif mode == "plan":
                # Plan-Act-Reflect 模式
                runner = self._make_runner(
                    provider=provider, model=model, temperature=temperature,
                    api_key=api_key, base_url=base_url,
                )
                chunks = PlanExecutor(runner).execute(session_id, content, history)
            elif mode == "skills":
                # skills 模式:按技能 ID 查询专属提示词和工具集
                skill = get_skill_by_id(skill_id)
                if skill:
                    logger.info("starting_skills_mode", session_id=session_id, skill=skill.id)
                    runner = self._make_runner(
                        provider=provider, model=model, temperature=temperature,
                        api_key=api_key, base_url=base_url,
                        tool_names=skill.tool_names,
                    )
                    chunks = runner.run(
                        session_id, content, history, images=images,
                        system_prompt=skill.system_prompt,
                    )
                else:
                    # 技能未找到,回退到 exec 模式
                    logger.warning("skill_not_found", skill_id=skill_id, fallback="exec")
                    runner = self._make_runner(
                        provider=provider, model=model, temperature=temperature,
                        api_key=api_key, base_url=base_url,
                    )
                    chunks = runner.run(session_id, content, history, images=images)
            elif mode == "mcp":
                # mcp 模式:连接用户配置的 MCP 服务器,发现工具并注入 AgentRunner
                mcp_manager = McpClientManager()
                try:
                    await mcp_manager.connect_all(mcp_servers)
                    mcp_tools = await mcp_manager.discover_tools()
                    logger.info("starting_mcp_mode", session_id=session_id, tools_count=len(mcp_tools))
                    runner = self._make_runner(
                        provider=provider, model=model, temperature=temperature,
                        api_key=api_key, base_url=base_url,
                        tools=mcp_tools,
                    )
                except Exception:
                    # 连接/发现阶段失败:关闭管理器后向上抛出
                    await mcp_manager.close()
                    raise

                # 包装流式输出,确保流结束后关闭 MCP 连接
                # (McpClientManager 必须存活到所有 chunk 消费完毕)
                async def _mcp_stream():
                    try:
                        async for chunk in runner.run(
                            session_id, content, history, images=images,
                            system_prompt=_MCP_SYSTEM_PROMPT,
                        ):
                            yield chunk
                    finally:
                        await mcp_manager.close()
                chunks = _mcp_stream()
            else:
                # 默认 exec 模式(ReAct 单智能体)
                runner = self._make_runner(
                    provider=provider, model=model, temperature=temperature,
                    api_key=api_key, base_url=base_url,
                )
                chunks = runner.run(session_id, content, history, images=images)

            # ── 流式消费 chunk,push 到 Redis 响应列表 ────────────────
            async for chunk in chunks:
                # 首个 chunk 打印日志(调试用)
                if not self._first_chunk_printed:
                    logger.info("first_chunk", session_id=session_id, chunk_preview=chunk[:80])
                    self._first_chunk_printed = True
                # rpush — 将 chunk 追加到响应列表尾部
                await self._publisher.rpush(response_list, chunk)
                # 设置 120 秒过期(避免列表无限增长)
                await self._publisher.expire(response_list, 120)
                # 若 chunk 是 JSON 且为 token 类型,累积到 full_response
                if chunk.startswith("{"):
                    try:
                        data = json.loads(chunk)
                        if data.get("type") == "token" and data.get("content"):
                            full_response += data["content"]
                    except json.JSONDecodeError:
                        pass

            # 记录助手回复到短期记忆
            self.memory.add_turn(session_id, "assistant", full_response)
            # 持久化完整 turn 到长期记忆(传入 api_key 用于 embedding)
            await self.memory.finish_turn(session_id, content, full_response, api_key=api_key)
            logger.info("session_completed", session_id=session_id)
            # 从运行中任务映射移除
            self._running_tasks.pop(session_id, None)
        except asyncio.CancelledError:
            # 用户取消(前端点击停止)
            logger.warning("task_cancelled", session_id=session_id)
            # 推送 done 信号,让 API Server 的轮询循环退出
            await self._publisher.rpush(response_list, json.dumps({"type": "done"}))
            await self._publisher.expire(response_list, 120)
        except Exception as exc:
            # 其他异常:打印堆栈,推送 error 和 done
            logger.error("session_error", session_id=session_id, error=str(exc), exc_info=True)
            err_msg = json.dumps({"type": "error", "message": str(exc)})
            done_msg = json.dumps({"type": "done"})
            await self._publisher.rpush(response_list, err_msg)
            await self._publisher.rpush(response_list, done_msg)
            await self._publisher.expire(response_list, 120)

    # ------------------------------------------------------------------ listen
    async def listen(self) -> None:
        """主循环:监听 Redis 请求列表,分发请求。

        同时启动取消监听器(订阅 agent:cancel 频道),
        收到取消消息时取消对应 session 的任务。
        """
        logger.info("worker_starting")
        # 确保已启动
        if not self._started:
            logger.info("calling_start")
            await self.start()
        logger.info("polling_redis_list", channel=REQUEST_CHANNEL)

        # ── 取消监听器 ──────────────────────────────────────────────
        # 通过 Redis pubsub 接收取消消息(前端点击停止时发布)
        cancel_channel = "agent:cancel"
        async def cancel_listener():
            """订阅 cancel 频道,收到消息时取消对应任务。"""
            pubsub = self.redis.pubsub()
            await pubsub.subscribe(cancel_channel)
            logger.info("listening_for_cancel", channel=cancel_channel)
            async for raw in pubsub.listen():
                if raw.get("type") == "message":
                    # data 是 session_id
                    sid = raw.get("data", "")
                    task = self._running_tasks.pop(sid, None)
                    if task and not task.done():
                        logger.info("cancelling_task", session_id=sid)
                        # 立即推送 done,让 API Server 轮询循环退出
                        await self._publisher.rpush(f"agent:response:list:{sid}", json.dumps({"type": "done"}))
                        # 取消任务(触发 CancelledError)
                        task.cancel()
        # 启动取消监听协程(后台运行)
        asyncio.create_task(cancel_listener())

        # ── 主轮询循环 ──────────────────────────────────────────────
        while True:
            try:
                # blpop — 阻塞式左弹,timeout=2 秒(避免永久阻塞,便于响应取消)
                result = await self.redis.blpop(REQUEST_CHANNEL, timeout=2)
                if result is not None:
                    # result 是 (key, value) 元组
                    _, raw = result
                    logger.info("request_received", raw_preview=raw[:120])
                    try:
                        # 解析请求 JSON
                        msg = json.loads(raw)
                        # 创建任务异步处理(不阻塞主循环,可并发处理多个请求)
                        asyncio.create_task(self.handle_request(msg))
                    except Exception as exc:
                        logger.error("parse_message_error", error=str(exc), exc_info=True)
            except Exception as exc:
                # 轮询异常(如 Redis 断连):打印日志并等待 1 秒重试
                logger.error("poll_error", error=str(exc), exc_info=True)
                await asyncio.sleep(1)


async def main() -> None:
    """主入口:创建 Worker 并启动监听。"""
    # 开发环境:启用彩色控制台输出(debug=True 走 ConsoleRenderer)
    configure_logging(debug=True)
    worker = AgentWorker()
    await worker.listen()


if __name__ == "__main__":
    # asyncio.run — 启动异步主函数
    asyncio.run(main())
