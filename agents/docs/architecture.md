# 架构

## 整体数据流

```
┌────────────┐    HTTP/SSE     ┌──────────────┐    Redis pub/sub    ┌─────────────┐
│ apps/web   │ ──────────────> │ apps/api-    │ ──────────────────> │ agents/     │
│ React 19   │                 │ server       │                     │ worker.py   │
│ Chat UI    │ <────────────── │ NestJS 11    │ <────────────────── │ AgentRunner │
└────────────┘    SSE token    └──────────────┘    Redis pub/sub    └─────────────┘
                                                                            │
                                                                            ▼
                                                                    ┌─────────────┐
                                                                    │ LLM Provider│
                                                                    │ OpenAI/     │
                                                                    │ Anthropic/  │
                                                                    │ Ollama      │
                                                                    └─────────────┘
```

## 目录结构

```
agents/src/
├── worker.py              # Redis 队列消费入口,5 模式分发
├── runner.py              # AgentRunner — ReAct Agent 核心循环
├── orchestrator.py        # MultiAgentOrchestrator — 多智能体分层委托
├── prompt_architect.py    # 为子智能体生成专属 system_prompt
├── decomposer.py          # 计划模式任务分解器
├── executor.py            # 计划步骤执行器
├── tools.py               # LangChain 工具定义(web_search/python_repl 等)
├── logger.py              # structlog 配置,全链路结构化日志
├── json_utils.py          # 容错 JSON 抽取(LLM 输出解析)
├── memory/                # 三层记忆系统
│   ├── embeddings.py      # sentence-transformers 嵌入
│   ├── vector_store.py    # Qdrant 向量存储
│   └── manager.py         # 短期/长期/画像记忆管理
├── skills/                # 内置技能(skills 模式)
│   └── registry.py        # 技能注册表(code-review/summarize/web-search)
├── mcp_client/            # MCP 模式客户端
│   └── client.py          # 连接外部 MCP 服务器,获取工具集
├── prompts/               # 提示词模板
│   ├── system.py          # 系统提示词(身份/能力/工具)
│   ├── tools.py           # 工具使用指南
│   ├── capabilities.py    # 能力描述
│   └── identity.py        # Agent 身份定义
└── models/                # 模型 Provider 注册
    └── provider.py        # OpenAI/Anthropic/Ollama 工厂
```

## 5 种工作模式

### 1. Exec 模式(默认)

ReAct Agent 直接执行,流式输出 token。

- 入口:`worker.py` → `AgentRunner.run_stream()`
- 无规划阶段,边推理边输出
- 适合简单问答、代码生成、文本处理

### 2. Plan 模式

任务分解 + 逐步执行,前端可视化进度。

- 入口:`worker.py` → `decomposer.py`(分解) → `executor.py`(执行)
- 先调用 LLM 生成步骤列表,推送 `plan` 事件
- 逐步执行每个步骤,推送 `step_start` / `step_complete` 事件
- 适合复杂任务(报告撰写、多步骤数据处理)

### 3. Multi 模式

多智能体协作,Coordinator 调度专家 Agent。

- 入口:`worker.py` → `orchestrator.py`(`MultiAgentOrchestrator`)
- CEO(Coordinator)分析任务 → 拆分为功能区域 → 委托子智能体
- 拓扑排序:无依赖的区域并行执行
- 递归深度限制:`MAX_DEPTH=2`(CEO → 子 → 孙)
- 角色约束:`PromptArchitect` 为每个子智能体生成专属 system_prompt
- 适合需要多种专业能力协作的复杂任务

### 4. Skills 模式

选择内置专用技能,获得定制提示词与工具集。

- 入口:`worker.py` → `skills/registry.py`
- 内置技能:`code-review` / `summarize` / `web-search`
- 每个技能定义 `system_prompt` 和 `tool_names`(可禁用部分工具)
- 适合特定场景的专用工作流

### 5. MCP 模式

连接外部 MCP(Model Context Protocol)服务器,使用其工具。

- 入口:`worker.py` → `mcp_client/client.py`
- 用户在 `mcp_servers` 表配置多个 MCP 服务器
- Worker 启动时连接活跃的 MCP 服务器,拉取工具列表
- Agent 在 ReAct 循环中使用 MCP 工具
- 适合接入外部能力(文件系统、数据库、API 客户端等)

## 记忆系统

三层记忆架构,基于 Qdrant 向量数据库:

| 层级 | 用途 | 集合名 | 嵌入维度 |
|------|------|--------|----------|
| 短期记忆 | 当前会话上下文(最近 N 轮) | `short_term` | 384 |
| 长期记忆 | 跨会话持久事实 | `long_term` | 384 |
| 用户画像 | 用户偏好与长期特征 | `user_profile` | 384 |

记忆检索流程:用户提问 → embedding → Qdrant 相似度检索 → 注入 system_prompt 上下文。

## 模型 Provider

`models/provider.py` 提供统一工厂接口,根据配置创建 LangChain `BaseChatModel`:

| Provider | 类 | 典型模型 |
|----------|------|----------|
| openai | `ChatOpenAI` | gpt-4o / gpt-4o-mini / gpt-4-turbo |
| anthropic | `ChatAnthropic` | claude-sonnet-4 / claude-3-5-haiku |
| ollama | `ChatOllama` | llama3 / mistral(本地部署) |

## 与 api-server 的协议

通过 Redis pub/sub 通信:

- **api-server → worker**:向 `chat:requests` 频道推送任务 JSON(`session_id`/`mode`/`message`/`mcp_servers` 等)
- **worker → api-server**:向 `chat:responses:{session_id}` 频道推送流式 chunk(`ChatChunk` 结构)
- **api-server → worker**:向 `chat:cancel:{session_id}` 频道推送取消信号

详细 `ChatChunk` 结构参见 [packages/shared/src/types/index.ts](https://github.com/ai-voice/ai-voice/blob/main/packages/shared/src/types/index.ts)。
