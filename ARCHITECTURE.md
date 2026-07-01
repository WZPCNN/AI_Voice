# 架构文档

AIVoice 是一个基于 pnpm + Turborepo 的 monorepo,包含前端、后端、共享库和 Python Agent 四大模块。

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/web (React 19)                       │
│  - 聊天界面、会话管理、模型选择、模式切换                           │
│  - 端口:3000 (Vite dev server)                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP REST + SSE (Server-Sent Events)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  apps/api-server (NestJS 11)                     │
│  - REST API、WebSocket、Redis pub/sub                            │
│  - 7 个模块:auth/chat/mcp/message/model-config/session/skills    │
│  - 端口:4000                                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │ Redis pub/sub
                     │ - chat:requests (api-server → worker)
                     │ - chat:responses:{session_id} (worker → api-server)
                     │ - chat:cancel:{session_id} (取消信号)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    agents/ (Python 3.14)                         │
│  - LangGraph 1.2 + LangChain 1.3 Agent 引擎                    │
│  - 5 种模式:exec/plan/multi/skills/mcp                           │
│  - Qdrant 向量记忆 (短期/长期/画像)                              │
│  - MCP 客户端 (连接外部工具服务器)                               │
└────────────────────┬────────────────────────────────────────────┘
                     │ LLM API 调用
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              LLM Providers (OpenAI/Anthropic/Ollama)             │
└─────────────────────────────────────────────────────────────────┘
```

## 数据流

### 1. 用户发送消息

```
用户输入 → apps/web (ChatInput)
  → POST /api/chat/stream (apps/api-server)
  → Redis pub: chat:requests (JSON: session_id/mode/message/mcp_servers)
  → agents/worker.py 消费
  → AgentRunner.run_stream() (根据 mode 分发)
  → LLM API 调用 (流式)
  → Redis pub: chat:responses:{session_id} (ChatChunk 事件)
  → apps/api-server 接收
  → SSE 推送 → apps/web 实时更新 UI
```

### 2. 5 种工作模式

| 模式       | 入口                                          | 行为                                                                  |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------- |
| **exec**   | `worker.py` → `AgentRunner.run_stream()`      | ReAct Agent 直接执行,流式输出 token                                   |
| **plan**   | `worker.py` → `decomposer.py` → `executor.py` | 先分解任务为步骤列表,逐步执行并推送进度                               |
| **multi**  | `worker.py` → `orchestrator.py`               | Coordinator 调度多 Agent 协作(拓扑排序并行执行)                       |
| **skills** | `worker.py` → `skills/registry.py`            | 选择内置技能(code-review/summarize/web-search),获得定制提示词与工具集 |
| **mcp**    | `worker.py` → `mcp_client/client.py`          | 连接外部 MCP 服务器,使用其工具                                        |

### 3. 记忆系统

三层记忆架构,基于 Qdrant 向量数据库:

| 层级     | 用途                      | 集合名         | 嵌入维度 |
| -------- | ------------------------- | -------------- | -------- |
| 短期记忆 | 当前会话上下文(最近 N 轮) | `short_term`   | 384      |
| 长期记忆 | 跨会话持久事实            | `long_term`    | 384      |
| 用户画像 | 用户偏好与长期特征        | `user_profile` | 384      |

记忆检索流程:用户提问 → sentence-transformers 嵌入 → Qdrant 相似度检索 → 注入 system_prompt 上下文。

## 组件职责

### apps/web (前端)

- **技术栈**:React 19.2.7 + TypeScript 6.0 + Vite 8.1 + Tailwind 4.3 + Zustand 5.0
- **核心组件**:
  - `ChatInput` — 聊天输入框(支持斜杠命令、图片上传)
  - `MessageList` — 消息列表(流式渲染、Markdown、工具调用展示)
  - `ModelSelector` — 模型配置下拉选择
  - `Sidebar` — 会话列表侧边栏
  - `PlanSection` — 计划模式进度可视化
  - `SkillsSelector` — skills 模式技能选择
  - `McpServersPanel` — mcp 模式服务器配置
- **状态管理**:Zustand (configStore/sessionStore)
- **路由**:React Router 7.18
- **Markdown 渲染**:react-markdown 10.1

### apps/api-server (后端)

- **技术栈**:NestJS 11.1.27 + Prisma 7.8 + Socket.io 4.8 + Redis 8
- **7 个模块**:
  - `auth` — JWT 认证、用户注册/登录
  - `chat` — 聊天核心逻辑(SSE 流式、Redis pub/sub、会话管理)
  - `mcp` — MCP 服务器配置 CRUD
  - `message` — 消息持久化
  - `model-config` — 模型配置 CRUD(支持多 Provider)
  - `session` — 会话 CRUD
  - `skills` — 内置技能列表(前端展示用)
- **数据库**:PostgreSQL 19 + Prisma ORM
- **缓存/消息**:Redis (pub/sub + 会话状态)
- **安全**:JWT + bcrypt + 环境变量加密(JWT_SECRET/ENCRYPTION_KEY)

### agents/ (Python Agent)

- **技术栈**:Python 3.14 + LangGraph 1.2.6 + LangChain 1.3.11 + Qdrant 1.18 + Redis 8.0
- **核心模块**:
  - `worker.py` — Redis 队列消费入口,5 模式分发
  - `runner.py` — AgentRunner (ReAct Agent 核心循环)
  - `orchestrator.py` — MultiAgentOrchestrator (多智能体分层委托)
  - `decomposer.py` — 计划模式任务分解器
  - `executor.py` — 计划步骤执行器
  - `prompt_architect.py` — 为子智能体生成专属 system_prompt
  - `tools.py` — LangChain 工具定义 (web_search/python_repl 等)
  - `logger.py` — structlog 结构化日志
  - `json_utils.py` — 容错 JSON 抽取 (LLM 输出解析)
- **子包**:
  - `memory/` — 三层记忆系统 (embeddings/vector_store/manager)
  - `skills/` — 内置技能注册表 (registry.py)
  - `mcp_client/` — MCP 客户端 (client.py)
  - `prompts/` — 提示词模板 (system/tools/capabilities/identity)
  - `models/` — 模型 Provider 工厂 (provider.py)

### packages/shared (共享库)

- **技术栈**:TypeScript 6.0 (源码直接导出,无构建)
- **导出类型**:
  - `AppMode` — 5 种工作模式
  - `Message` — 消息实体
  - `PlanStep` — 计划步骤
  - `ChatChunk` — SSE 流式数据块
  - `SkillInfo` — 内置技能信息
  - `McpServerConfig` — MCP 服务器配置
  - `ModelConfig` — 模型配置
- **用途**:apps/web 和 apps/api-server 共同引用,保证前后端数据结构一致

## 基础设施

### 数据库

- **PostgreSQL 19** — 主数据库 (用户/会话/消息/模型配置/MCP 服务器)
- **Qdrant** — 向量数据库 (三层记忆)
- **Redis 8** — 缓存 + 消息队列 (pub/sub)

### 环境变量

| 变量                | 用途                  | 必需                  |
| ------------------- | --------------------- | --------------------- |
| `OPENAI_API_KEY`    | OpenAI API 密钥       | 是 (若使用 OpenAI)    |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥    | 是 (若使用 Anthropic) |
| `JWT_SECRET`        | JWT 签名密钥          | 是                    |
| `ENCRYPTION_KEY`    | 敏感数据加密密钥      | 是                    |
| `DATABASE_URL`      | PostgreSQL 连接字符串 | 是                    |
| `REDIS_URL`         | Redis 连接字符串      | 是                    |
| `QDRANT_URL`        | Qdrant 连接字符串     | 是                    |

## 开发命令

| 命令                                            | 说明                                          |
| ----------------------------------------------- | --------------------------------------------- |
| `pnpm install`                                  | 安装所有 JS 依赖                              |
| `pnpm dev`                                      | 并行启动所有 dev server (web + api-server)    |
| `pnpm build`                                    | 构建所有包                                    |
| `pnpm typecheck`                                | TypeScript 类型检查                           |
| `pnpm lint`                                     | ESLint 代码规范检查                           |
| `pnpm test`                                     | 运行所有测试                                  |
| `pnpm docs`                                     | 构建所有文档 (Storybook + TypeDoc + Compodoc) |
| `cd agents && uv sync`                          | 安装 Python 依赖                              |
| `cd agents && uv run pytest`                    | 运行 Python 测试                              |
| `cd agents && uv run --group docs mkdocs serve` | 启动 Python 文档站 (http://127.0.0.1:8000)    |

## 文档体系

- **Storybook** — 前端组件库 (apps/web)
- **TypeDoc** — TypeScript API 参考 (apps/api-server + packages/shared)
- **Compodoc** — NestJS 架构图 (apps/api-server)
- **MkDocs Material** — Python API 参考 (agents/)
- **GitHub Pages** — 自动部署所有文档站 (push main → 构建 → 部署)

详细文档构建命令参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
