"""MCP 客户端包 — 连接 MCP 服务器并发现工具。

提供 McpClientManager 管理多个 MCP 服务器连接,
发现工具并包装为 LangChain StructuredTool,
供 AgentRunner 在 mcp 模式下使用。

使用方式:
    from mcp_client import McpClientManager
    manager = McpClientManager()
    await manager.connect_all(servers)
    tools = await manager.discover_tools()
    # ... tools 传给 AgentRunner ...
    await manager.close()
"""
from .client import McpClientManager

__all__ = ["McpClientManager"]
