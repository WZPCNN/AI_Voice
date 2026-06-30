# AI Voice

通用智能体平台，支持自主规划推理、多模态感知、工具使用、记忆个性化、多智能体协作。

## 项目结构

```
apps/
  web/          React 19 + Vite 8 + Tailwind 4 前端
  api-server/   NestJS 11 + Prisma 7 API 网关
packages/
  shared/       共享 TypeScript 6 类型
  eslint-config/ 共享 ESLint 配置
agents/
  src/
    worker.py           Worker 入口 (Redis 队列消费)
    runner.py           AgentRunner (ReAct Agent 核心循环)
    orchestrator.py     多智能体编排器 (分层委托)
    decomposer.py       任务分解器
    executor.py         计划执行器
    prompt_architect.py 提示词架构师
    tools.py            LangChain 工具定义
    memory/             三层记忆系统 (Qdrant 向量数据库)
    skills/             内置技能注册表
    mcp_client/         MCP 客户端
    prompts/            提示词模板
    models/             模型 Provider 工厂
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
cd agents && uv sync
```

### 2. 启动基础设施

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 3. 配置环境变量

```bash
cp .env.example .env
cp agents/.env.example agents/.env
# 编辑 agents/.env 填入 OPENAI_API_KEY
```

### 4. 启动服务 (三个终端)

```bash
# 终端 1 - Python Worker
cd agents
$env:OPENAI_API_KEY="sk-..."
$env:PYTHONPATH="src"; .venv\Scripts\python.exe -m worker

# 终端 2 - API Server
cd apps/api-server && pnpm dev

# 终端 3 - Web
cd apps/web && pnpm dev
# 打开 http://localhost:3000
```

## 五种模式

| 模式   | 行为                                            |
| ------ | ----------------------------------------------- |
| Exec   | ReAct Agent 直接执行，流式输出                  |
| Plan   | 先规划步骤，逐步执行，可视化进度                |
| Multi  | Coordinator 调度多 Agent 协作                   |
| Skills | 技能模式，使用预定义技能（代码审查/摘要/搜索）  |
| MCP    | Model Context Protocol 模式，连接外部工具服务器 |

## 模型切换

| Provider  | 模型                              |
| --------- | --------------------------------- |
| openai    | gpt-4o, gpt-4o-mini, gpt-4-turbo  |
| anthropic | claude-sonnet-4, claude-3-5-haiku |
| ollama    | llama3, mistral                   |

## 开发命令

| 命令                       | 说明                |
| -------------------------- | ------------------- |
| pnpm install               | 安装 JS 依赖        |
| pnpm dev                   | 并行启动 dev server |
| pnpm build                 | 构建所有包          |
| pnpm typecheck             | 类型检查            |
| pnpm lint                  | 代码规范检查        |
| cd agents && uv run pytest | Python 测试         |

## 技术栈

- 前端: React 19 + TypeScript 6 + Vite 8 + TailwindCSS 4 + Zustand 5
- 网关: NestJS 11 + WebSocket + Redis pub/sub
- Agent: Python 3.14 + LangChain 1.3 + LangGraph 1.2 + Qdrant + sentence-transformers
- 基础设施: PostgreSQL 17 + Qdrant + Redis 7 + Turborepo + pnpm 11
- 文档: Storybook 9 + TypeDoc + Compodoc + MkDocs Material

## 文档

项目提供完整的文档体系，通过 GitHub Pages 自动部署：

```bash
# 本地构建所有文档
pnpm docs

# 或分别构建
pnpm --filter @ai-voice/web docs          # Storybook (前端组件)
pnpm --filter @ai-voice/api-server docs   # TypeDoc + Compodoc (后端 API)
pnpm --filter @ai-voice/shared docs       # TypeDoc (共享类型)
cd agents && uv run mkdocs build          # MkDocs (Python Agent)
```

文档站结构：

- `/` - 文档索引
- `/storybook/` - 前端组件库 (Storybook)
- `/typedoc-api/` - 后端 API 文档 (TypeDoc)
- `/typedoc-shared/` - 共享类型文档 (TypeDoc)
- `/compodoc/` - 后端架构图 (Compodoc)
- `/python/` - Python Agent 文档 (MkDocs)

## 贡献

详见 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解开发环境搭建、代码规范、提交流程等。

架构设计详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
