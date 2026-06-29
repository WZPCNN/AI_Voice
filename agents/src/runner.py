"""ReAct Agent 运行器 — 基于 langgraph >=1.2 的状态图与流式输出。

ReAct(Reasoning + Acting)模式:LLM 思考→调用工具→观察结果→继续思考...
通过 langgraph 的 create_react_agent 内置实现。

凭据流:所有 LLM/embedding 凭据来自请求消息(经 API Server 传入),
通过 ``api_key`` / ``base_url`` 参数向下传递。
环境变量仅作最后兜底。
"""
# json — 标准库,用于将 chunk 序列化为 JSON 字符串
import json
# AsyncIterator — 异步迭代器类型注解
# Any — 任意类型注解
from typing import AsyncIterator, Any
# create_react_agent — langgraph 预置的 ReAct Agent 工厂
# 内部构建"LLM ↔ tools"循环的状态图
from langgraph.prebuilt import create_react_agent
# MemorySaver — langgraph 的内存检查点器
# 用于按 thread_id 持久化对话状态,支持多轮上下文
from langgraph.checkpoint.memory import MemorySaver
# LangChain 消息类型:
#   HumanMessage — 用户消息
#   SystemMessage — 系统指令
#   AIMessage — AI 回复
#   BaseMessage — 所有消息的基类(用于类型注解)
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage
# get_tools_by_name — 按名称获取工具列表
from tools import get_tools_by_name
# SYSTEM_PROMPT — 默认系统提示词
from prompts import SYSTEM_PROMPT
# create_model — 模型工厂函数
from models.provider import create_model


class AgentRunner:
    """单 Agent ReAct 运行器。

    Parameters:
        model_provider: "openai" | "anthropic" | "ollama"
        model_name: 模型名,如 "gpt-4o"
        api_key: API Key(来自数据库配置,优先级高于环境变量)
        base_url: 自定义 base URL(来自数据库配置)
        tool_names: 启用的工具名列表,None 时启用全部内置工具
        tools: 显式传入的工具列表(优先级高于 tool_names,mcp 模式用)
        temperature: 采样温度
        memory_manager: 记忆管理器实例(可选)
    """

    def __init__(
        self, *,
        # * 表示后续参数必须关键字传递,提高可读性
        model_provider: str = "openai",
        model_name: str = "gpt-4o",
        tool_names: list[str] | None = None,
        tools: list | None = None,
        temperature: float = 0.7,
        memory_manager: Any = None,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        # 保存配置供外部读取(orchestrator 等会读取这些字段)
        self.model_provider = model_provider
        self.model_name = model_name
        self.temperature = temperature
        self.api_key = api_key
        self.base_url = base_url
        # 工具来源优先级:显式传入 tools > 按 tool_names 筛选内置工具
        # mcp 模式下 tools 为 MCP 服务器发现的工具;其他模式用内置工具
        if tools is not None:
            self.tools = tools
        else:
            self.tools = get_tools_by_name(tool_names)
        # 创建基础 LLM(streaming=True 启用流式输出)
        llm_base = create_model(
            model_provider, model_name, temperature, streaming=True,
            api_key=api_key, base_url=base_url,
        )
        # 仅原生 OpenAI(无自定义 base_url)才绑定 tools
        # 原因:DeepSeek 等 OpenAI 兼容服务的 function calling 实现可能不稳定
        if base_url is None:
            self.llm = llm_base.bind_tools(self.tools)
        else:
            self.llm = llm_base
        # 记忆管理器(可为 None)
        self.memory = memory_manager
        # MemorySaver — langgraph 的内存检查点器
        # 通过 thread_id(= session_id)区分不同会话
        self.checkpointer = MemorySaver()
        # 构建 ReAct 状态图
        self.graph = self._build_graph()

    # ------------------------------------------------------------------ graph
    def _build_graph(self):
        """使用 langgraph 内置的 create_react_agent 构建 ReAct 状态图。

        状态图逻辑:
          1. LLM 接收消息,决定是否调用工具
          2. 若调用工具,执行工具并将结果回传给 LLM
          3. 重复 1-2,直到 LLM 不再调用工具,输出最终回复
        checkpointer 用于持久化对话状态(按 thread_id)。
        """
        return create_react_agent(self.llm, self.tools, checkpointer=self.checkpointer)

    # --------------------------------------------------------------- streaming
    async def run(
        self,
        session_id: str,
        user_message: str,
        history: list[dict] | None = None,
        images: list[str] | None = None,
        system_prompt: str | None = None,
    ) -> AsyncIterator[str]:
        """执行一次 ReAct 对话,流式输出 chunk。

        每个 chunk 是一行 JSON 字符串(以 \\n 结尾),格式:
          - {"type": "token", "content": "..."} — LLM 输出 token
          - {"type": "tool_start", "tool": "..."} — 工具开始执行
          - {"type": "tool_end", "tool": "...", "output": "..."} — 工具执行结束
          - {"type": "done"} — 整轮对话结束

        Args:
            session_id: 会话 ID(用作 langgraph thread_id)
            user_message: 用户消息文本
            history: 历史对话列表 [{"role": "user"|"assistant", "content": "..."}]
            images: 图片列表(Base64 字符串或 data URL)
            system_prompt: 自定义系统提示词(None 时用默认 SYSTEM_PROMPT)
        Yields:
            str: JSON chunk 字符串
        """
        # 选择系统提示词:自定义 > 默认
        prompt_text = system_prompt if system_prompt else SYSTEM_PROMPT
        # 消息列表,首条必须是 SystemMessage
        messages: list[BaseMessage] = [SystemMessage(content=prompt_text)]

        # --- 记忆上下文(api_key 向下传递用于 embedding) -------------
        if self.memory:
            ctx = await self.memory.build_context(session_id, user_message, api_key=self.api_key)
            if ctx:
                # 记忆上下文作为额外的 SystemMessage 注入
                messages.append(SystemMessage(content=f"Memory context:\n{ctx}"))

        # --- 历史对话 -------------------------------------------------
        if history:
            for msg in history:
                role = msg.get("role", "")
                content = msg.get("content", "")
                # 仅处理 user 和 assistant 两种角色
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    messages.append(AIMessage(content=content))

        # --- 多模态输入(图片) ---------------------------------------
        if images:
            # 多模态消息的 content 是 content_blocks 列表
            content_blocks: list[dict] = [{"type": "text", "text": user_message}]
            for img in images:
                # 若未带 data: 前缀,补上 Base64 图片前缀
                prefix = "" if img.startswith("data:") else "data:image/jpeg;base64,"
                content_blocks.append({"type": "image_url", "image_url": {"url": prefix + img}})
            messages.append(HumanMessage(content=content_blocks))
        else:
            # 纯文本消息
            messages.append(HumanMessage(content=user_message))

        # --- 通过 astream_events 流式获取事件(langgraph >= 1.2) -----
        # thread_id = session_id,使 langgraph 能按会话加载/保存检查点
        config = {"configurable": {"thread_id": session_id}}
        # astream_events(version="v2") — 事件流 API
        # 比 astream 更细粒度,可捕获工具调用、token 流等
        async for event in self.graph.astream_events({"messages": messages}, config=config, version="v2"):
            kind = event["event"]
            # on_chat_model_stream — LLM 输出 token
            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    text = chunk.content
                    # 处理多模态/工具调用内容块(content 可能是列表)
                    if isinstance(text, list):
                        parts: list[str] = []
                        for item in text:
                            if isinstance(item, str):
                                parts.append(item)
                            elif isinstance(item, dict) and item.get("type") == "text":
                                parts.append(str(item.get("text", "")))
                        text = "".join(parts)
                    # 仅输出非空文本(过滤空白 token)
                    if text and isinstance(text, str) and text.strip():
                        yield json.dumps({"type": "token", "content": text}) + "\n"
            # on_tool_start — 工具开始执行
            elif kind == "on_tool_start":
                yield json.dumps({"type": "tool_start", "tool": event["name"]}) + "\n"
            # on_tool_end — 工具执行结束
            elif kind == "on_tool_end":
                output = str(event["data"].get("output", ""))
                yield json.dumps({"type": "tool_end", "tool": event["name"], "output": output}) + "\n"

        # 整轮对话结束
        yield json.dumps({"type": "done"}) + "\n"
