# API 参考

本页由 mkdocstrings 自动从 Python 源码 docstring 抽取生成。
所有类与函数遵循 [Google 风格 docstring](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)。

## 核心运行器

### AgentRunner

ReAct Agent 核心循环,负责 LLM 调用、工具执行、流式输出。

::: src.runner

## 多智能体编排

### MultiAgentOrchestrator

混合串行/并行编排器,支持递归委托。

::: src.orchestrator

### PromptArchitect

为子智能体生成专属 system_prompt 和 constraint_prompt。

::: src.prompt_architect

## 计划模式

### Decomposer

任务分解器,将复杂任务拆分为可执行步骤列表。

::: src.decomposer

### PlanExecutor

计划步骤执行器,逐步执行并推送进度事件。

::: src.executor

## 技能注册表

### Skill / BUILTIN_SKILLS

内置技能定义与查询。skills 模式下,worker 通过 skill_id 查询此注册表,
获取该技能的 system_prompt 和 tool_names。

::: src.skills.registry

## MCP 客户端

### McpClient

连接外部 MCP 服务器,获取工具集并转换为 LangChain 工具格式。

::: src.mcp_client.client

## 记忆系统

### MemoryManager

三层记忆系统管理器:短期 / 长期 / 用户画像。

::: src.memory.manager

### VectorStore

Qdrant 向量存储封装,提供集合管理与相似度检索。

::: src.memory.vector_store

### Embeddings

sentence-transformers 嵌入封装,将文本转为 384 维向量。

::: src.memory.embeddings

## 模型 Provider

### create_model

模型工厂函数,根据配置创建 LangChain `BaseChatModel`。

::: src.models.provider

## 入口

### worker

Redis 队列消费入口,5 模式分发。

::: src.worker
