# Agent Engine

AIVoice 项目的 Python Agent 引擎,基于 **LangGraph 1.2 + LangChain 1.3 + Qdrant + MCP** 构建,
提供 5 种工作模式:`exec` / `plan` / `multi` / `skills` / `mcp`。

## 核心能力

- **多模式执行**:ReAct 直接执行、计划分解执行、多智能体协作、技能专用模式、MCP 外部工具模式
- **向量记忆**:基于 Qdrant 的短期/长期/画像三层记忆系统,支持相似度检索
- **多模型支持**:OpenAI / Anthropic / Ollama 三大 Provider,运行时切换
- **MCP 集成**:通过 Model Context Protocol 接入外部工具服务器
- **结构化日志**:structlog 全链路日志,支持 JSON 输出
- **流式输出**:Redis pub/sub 实时推送 token / plan / step / tool 事件

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| Agent 框架 | LangGraph | 1.2.6 |
| LLM 抽象 | LangChain | 1.3.11 |
| LLM Provider | langchain-openai/anthropic/ollama | 1.3.3 / 1.4.8 / 1.1.0 |
| 向量数据库 | Qdrant | client 1.18.0 |
| 记忆嵌入 | sentence-transformers | 5.6.0 |
| 消息中间件 | Redis | 8.0.1 |
| MCP | mcp | >=1.12.0 |
| 结构化日志 | structlog | 26.1.0 |
| Python | CPython | >=3.12,<3.15 |

## 快速开始

```bash
# 安装依赖(含 docs 组用于生成此文档)
uv sync --group docs

# 启动 worker(消费 Redis 队列,处理用户会话)
$env:OPENAI_API_KEY="sk-..."
$env:PYTHONPATH="src"
.venv\Scripts\python.exe -m worker

# 运行测试
uv run pytest

# 启动本地文档站(开发预览)
uv run --group docs mkdocs serve
# 访问 http://127.0.0.1:8000
```

## 文档导航

- [架构](architecture.md) — 数据流、组件职责、5 种模式详解
- [API 参考](api.md) — 自动抽取的核心模块文档

## 与主项目的关系

本目录是 [AIVoice monorepo](../README.md) 的 Python Agent 子项目,
由根目录 `apps/api-server`(NestJS)通过 Redis pub/sub 调度。
前端在 `apps/web`(React 19)。

详细架构请参见根目录 [ARCHITECTURE.md](../ARCHITECTURE.md)。
