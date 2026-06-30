"""MCP 客户端管理器 — 连接多个 MCP 服务器,发现工具并包装为 LangChain 工具。

MCP(Model Context Protocol)允许用户配置外部工具服务器,
Python worker 在 mcp 模式下连接用户活跃的 MCP 服务器,
发现其提供的工具,包装为 LangChain StructuredTool,
注入 AgentRunner 的 create_react_agent。

传输方式:
  - stdio: 启动子进程,通过 stdin/stdout 通信(适用于本地工具)
  - sse: 通过 HTTP SSE 通信(适用于远程工具)

生命周期:
  1. connect_all(servers) — 连接所有配置的服务器
  2. discover_tools() — 发现并包装工具
  3. 工具随 AgentRunner 一起被 LLM 调用
  4. close() — 关闭所有连接(必须在 finally 中调用)

异常处理策略:
  单个服务器连接失败不阻断其他服务器,仅记录日志。
"""
# os — 标准库,读取环境变量用于 stdio 子进程继承
import os
# shlex — 标准库,安全解析命令字符串(处理引号)
import shlex
# AsyncExitStack — 标准库,管理多个异步上下文的统一退出
from contextlib import AsyncExitStack
# pydantic.create_model — 动态创建 Pydantic 模型(从 JSON Schema)
# pydantic.Field — 字段定义,附加 description
from pydantic import create_model, Field
# langchain_core.tools.StructuredTool — 结构化工具(带参数 schema)
# langchain_core.tools.BaseTool — 工具基类(类型注解用)
from langchain_core.tools import StructuredTool, BaseTool
# mcp.ClientSession — MCP 客户端会话
# mcp.StdioServerParameters — stdio 传输参数
from mcp import ClientSession, StdioServerParameters
# mcp.client.stdio.stdio_client — stdio 传输客户端
from mcp.client.stdio import stdio_client
# mcp.client.sse.sse_client — SSE 传输客户端
from mcp.client.sse import sse_client
# get_logger — structlog 结构化日志
from logger import get_logger

# ── 模块级 logger ──────────────────────────────────────────────────────────
logger = get_logger(__name__)

# ── JSON Schema type → Python type 映射表 ──────────────────────────────────
# MCP 工具的 inputSchema 使用 JSON Schema,需转换为 Pydantic 字段类型
_JSON_TYPE_MAP: dict[str, type] = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
    "array": list,
    "object": dict,
}


class McpClientManager:
    """管理多个 MCP 服务器连接,发现并包装工具为 LangChain StructuredTool。

    Usage:
        manager = McpClientManager()
        await manager.connect_all(servers)
        tools = await manager.discover_tools()
        # ... 使用 tools 创建 AgentRunner ...
        await manager.close()
    """

    def __init__(self) -> None:
        # AsyncExitStack — 统一管理所有连接的生命周期
        # 进入时注册,close() 时按 LIFO 顺序退出
        self._exit_stack = AsyncExitStack()
        # 已连接的 MCP 会话列表
        self._sessions: list[ClientSession] = []
        # 已发现的 LangChain 工具列表
        self._tools: list[BaseTool] = []

    # ------------------------------------------------------------ connect
    async def connect_stdio(self, name: str, command: str, env: dict | None = None) -> bool:
        """连接一个 stdio 传输的 MCP 服务器。

        Args:
            name: 服务器名称(日志用)
            command: 启动命令字符串,如 "npx -y @modelcontextprotocol/server-filesystem /tmp"
            env: 额外环境变量(合并到当前进程环境)
        Returns:
            True 连接成功,False 连接失败(已记录日志)
        """
        try:
            # shlex.split 安全解析命令(处理引号包裹的参数)
            parts = shlex.split(command)
            if not parts:
                logger.warning("mcp_stdio_empty_command", server=name)
                return False
            # 合并环境变量:当前进程环境 + 用户配置的额外变量
            merged_env = {**os.environ, **env} if env else None
            # StdioServerParameters — 描述子进程启动方式
            params = StdioServerParameters(
                command=parts[0],
                args=parts[1:],
                env=merged_env,
            )
            # stdio_client 返回 (read_stream, write_stream) 元组
            read, write = await self._exit_stack.enter_async_context(stdio_client(params))
            # ClientSession 在 enter 时建立连接
            session = await self._exit_stack.enter_async_context(ClientSession(read, write))
            # initialize 完成 MCP 协议握手
            await session.initialize()
            self._sessions.append(session)
            logger.info("mcp_stdio_connected", server=name, command=command)
            return True
        except Exception as exc:
            # 单个服务器连接失败不阻断其他服务器
            logger.warning("mcp_stdio_connect_failed", server=name, error=str(exc), exc_info=True)
            return False

    async def connect_sse(self, name: str, url: str) -> bool:
        """连接一个 SSE 传输的 MCP 服务器。

        Args:
            name: 服务器名称(日志用)
            url: SSE 端点 URL,如 "http://localhost:3001/sse"
        Returns:
            True 连接成功,False 连接失败(已记录日志)
        """
        try:
            # sse_client 返回 (read_stream, write_stream) 元组
            read, write = await self._exit_stack.enter_async_context(sse_client(url))
            session = await self._exit_stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            self._sessions.append(session)
            logger.info("mcp_sse_connected", server=name, url=url)
            return True
        except Exception as exc:
            logger.warning("mcp_sse_connect_failed", server=name, url=url, error=str(exc), exc_info=True)
            return False

    async def connect_all(self, servers: list[dict]) -> None:
        """批量连接多个 MCP 服务器(best-effort,单个失败不阻断)。

        Args:
            servers: 服务器配置列表,每项含:
                - name: 服务器名称
                - transport: "stdio" | "sse"
                - command: 启动命令(stdio 时必填)
                - url: SSE URL(sse 时必填)
                - env: 环境变量(stdio 时可选)
        """
        for s in servers:
            transport = s.get("transport", "stdio")
            name = s.get("name", "unknown")
            env = s.get("env") or None
            if transport == "sse":
                url = s.get("url") or ""
                if url:
                    await self.connect_sse(name, url)
                else:
                    logger.warning("mcp_sse_missing_url", server=name)
            else:
                command = s.get("command") or ""
                if command:
                    await self.connect_stdio(name, command, env)
                else:
                    logger.warning("mcp_stdio_missing_command", server=name)

    # ------------------------------------------------------------ discover
    async def discover_tools(self) -> list[BaseTool]:
        """从所有已连接的 MCP 服务器发现工具,包装为 LangChain StructuredTool。

        Returns:
            LangChain 工具列表(可直接传给 create_react_agent)
        """
        tools: list[BaseTool] = []
        for session in self._sessions:
            try:
                result = await session.list_tools()
                for mcp_tool in result.tools:
                    lc_tool = self._wrap_tool(session, mcp_tool)
                    tools.append(lc_tool)
            except Exception as exc:
                logger.warning("mcp_list_tools_failed", error=str(exc), exc_info=True)
        self._tools = tools
        logger.info("mcp_tools_discovered", count=len(tools))
        return tools

    def _wrap_tool(self, session: ClientSession, mcp_tool: object) -> BaseTool:
        """将单个 MCP 工具包装为 LangChain StructuredTool。

        Args:
            session: MCP 会话(用于调用工具)
            mcp_tool: MCP 工具对象(含 name/description/inputSchema)
        Returns:
            LangChain StructuredTool 实例
        """
        # 读取工具元信息(inputSchema 可能为 None)
        tool_name: str = getattr(mcp_tool, "name", "unknown")
        tool_desc: str = getattr(mcp_tool, "description", "") or ""
        schema: dict = getattr(mcp_tool, "inputSchema", None) or {
            "type": "object",
            "properties": {},
        }
        # JSON Schema → Pydantic 模型
        args_model = self._schema_to_model(tool_name, schema)

        # 定义异步调用函数(闭包捕获 session 和 tool_name)
        async def _run(**kwargs: object) -> str:
            """实际调用 MCP 工具的函数。

            被 LangChain StructuredTool 调用时,
            kwargs 为 LLM 解析出的参数。
            """
            result = await session.call_tool(tool_name, kwargs)
            # MCP 工具返回 content blocks 列表,提取文本
            texts: list[str] = []
            for block in (result.content or []):
                text = getattr(block, "text", None)
                if text:
                    texts.append(text)
                else:
                    texts.append(str(block))
            return "\n".join(texts) if texts else ""

        # StructuredTool.from_function — 从协程创建结构化工具
        return StructuredTool.from_function(
            coroutine=_run,
            name=tool_name,
            description=tool_desc,
            args_schema=args_model,
        )

    def _schema_to_model(self, tool_name: str, schema: dict) -> type:
        """将 JSON Schema 转换为 Pydantic 模型类。

        MCP 工具的 inputSchema 是标准 JSON Schema,
        LangChain 需要 Pydantic BaseModel 作为 args_schema。

        Args:
            tool_name: 工具名(用于生成模型类名)
            schema: JSON Schema 字典
        Returns:
            动态创建的 Pydantic 模型类
        """
        props: dict = schema.get("properties", {})
        required: set[str] = set(schema.get("required", []))
        fields: dict = {}
        for prop_name, prop_schema in props.items():
            # JSON Schema type → Python type,默认 str
            json_type = prop_schema.get("type", "string")
            py_type = _JSON_TYPE_MAP.get(json_type, str)
            desc = prop_schema.get("description", "")
            if prop_name in required:
                # 必填字段:无默认值
                fields[prop_name] = (py_type, Field(description=desc))
            else:
                # 可选字段:默认 None,使用 Python 3.10+ 联合类型语法
                fields[prop_name] = (py_type | None, Field(default=None, description=desc))
        # create_model 动态创建 Pydantic 模型类
        # 类名格式:{tool_name}_Input,避免冲突
        return create_model(f"{tool_name}_Input", **fields)  # type: ignore[arg-type]

    # ------------------------------------------------------------ lifecycle
    @property
    def tools(self) -> list[BaseTool]:
        """已发现的 LangChain 工具列表。"""
        return self._tools

    async def close(self) -> None:
        """关闭所有 MCP 连接。

        必须在 worker 处理完请求后调用(通常在 finally 块中)。
        AsyncExitStack 会按 LIFO 顺序退出所有上下文。
        """
        try:
            await self._exit_stack.aclose()
        except Exception as exc:
            logger.warning("mcp_close_error", error=str(exc), exc_info=True)
        finally:
            self._sessions.clear()
            self._tools.clear()
