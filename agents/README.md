# AI Voice Agents

Python Agent 引擎,基于 LangGraph + LangChain 构建的智能体系统。

## 技术栈

- **语言**: Python 3.12+
- **包管理**: uv
- **Agent 框架**: LangGraph 1.2.6 + LangChain 1.3.11
- **向量数据库**: Qdrant
- **缓存**: Redis
- **MCP**: Model Context Protocol 支持

## 目录结构

```
agents/
├── src/
│   ├── worker.py              # Worker 入口,处理 Redis 队列
│   ├── runner.py              # AgentRunner,执行 Agent 逻辑
│   ├── orchestrator.py        # 多 Agent 编排器
│   ├── decomposer.py          # 任务分解器
│   ├── executor.py            # 计划执行器
│   ├── prompt_architect.py    # 提示词架构师
│   ├── tools.py               # 工具定义
│   ├── logger.py              # 日志工具
│   ├── json_utils.py          # JSON 处理工具
│   ├── memory/                # 记忆模块
│   │   ├── embeddings.py      # 嵌入生成
│   │   ├── vector_store.py    # 向量存储
│   │   └── manager.py         # 记忆管理
│   ├── skills/                # 技能模块
│   │   └── registry.py        # 技能注册表
│   ├── mcp_client/            # MCP 客户端
│   │   └── client.py          # MCP 连接管理
│   ├── prompts/               # 提示词模板
│   │   ├── system.py          # 系统提示词
│   │   ├── tools.py           # 工具提示词
│   │   ├── capabilities.py    # 能力提示词
│   │   └── identity.py        # 身份提示词
│   └── models/                # 模型配置
│       └── provider.py        # 模型提供商
├── tests/                     # 测试文件
├── pyproject.toml             # 项目配置
└── uv.lock                    # 依赖锁定
```

## 核心组件

### Worker

Redis 队列消费者,接收来自 API Server 的任务请求:

```python
# 监听 Redis 队列
# 解析任务参数
# 调用 AgentRunner 执行任务
# 将结果推送回 Redis
```

### AgentRunner

核心执行引擎,根据模式执行不同的 Agent 逻辑:

- **exec 模式**: 直接执行,快速响应
- **plan 模式**: 先制定计划,再逐步执行
- **multi 模式**: 多 Agent 协作,任务分解与编排
- **skills 模式**: 使用预定义技能
- **mcp 模式**: 调用外部 MCP 工具

### Orchestrator

多 Agent 编排器,管理 Agent 间的协作:

- 任务分解
- Agent 分配
- 结果聚合
- 错误处理

### Memory System

三层记忆系统:

- **短期记忆**: 当前会话上下文
- **长期记忆**: 跨会话的持久化记忆
- **用户画像**: 用户偏好和行为模式

### Skills Registry

技能注册表,管理预定义技能:

- 技能发现
- 技能执行
- 技能参数验证

### MCP Client

Model Context Protocol 客户端,连接外部工具:

- MCP 服务器连接
- 工具调用
- 结果处理

## 开发命令

```bash
# 安装依赖
uv sync

# 安装文档依赖
uv sync --group docs

# 运行测试
uv run pytest

# 类型检查
uv run mypy src

# 代码格式化
uv run ruff format src

# 代码检查
uv run ruff check src

# 启动 Worker
uv run python src/worker.py

# 生成文档
uv run mkdocs build

# 本地预览文档
uv run mkdocs serve
# 访问 http://localhost:8000
```

## 环境变量

在 `agents/.env` 中配置:

```bash
# Redis 连接
REDIS_URL=redis://localhost:6379

# Qdrant 连接
QDRANT_URL=http://localhost:6333

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Anthropic API
ANTHROPIC_API_KEY=your-anthropic-api-key

# 日志级别
LOG_LEVEL=INFO
```

## 测试

```bash
# 运行所有测试
uv run pytest

# 运行特定测试文件
uv run pytest tests/test_runner.py

# 生成覆盖率报告
uv run pytest --cov=src --cov-report=html
```

## 文档

使用 MkDocs 生成文档:

```bash
# 构建文档
uv run mkdocs build

# 本地预览
uv run mkdocs serve
```

文档输出到 `site/` 目录。

## 添加新技能

1. 在 `src/skills/` 下创建新技能文件
2. 实现技能接口
3. 在 `registry.py` 中注册技能
4. 添加测试

## 添加新工具

1. 在 `src/tools.py` 中定义工具
2. 实现工具接口
3. 在工具注册表中注册
4. 添加测试

## 许可证

MIT
