# 贡献指南

感谢你对 AIVoice 项目的关注!本文档将帮助你了解如何参与项目开发。

## 开发环境

### 系统要求

- **Node.js**: 22.x (推荐使用 nvm 管理版本)
- **pnpm**: 11.9+ (monorepo 包管理器)
- **Python**: 3.12+ (Agent 引擎)
- **uv**: 最新版 (Python 包管理器)
- **PostgreSQL**: 19 (主数据库)
- **Redis**: 8+ (缓存与消息队列)
- **Qdrant**: 最新版 (向量数据库)

### 初始设置

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/ai-voice.git
cd ai-voice

# 2. 安装 JS 依赖
pnpm install

# 3. 安装 Python 依赖
cd agents
uv sync --group docs

# 4. 启动基础设施 (PostgreSQL + Redis + Qdrant)
docker compose up -d

# 5. 配置环境变量
cp apps/api-server/.env.example apps/api-server/.env
cp agents/.env.example agents/.env
# 编辑 .env 文件,填入 API 密钥和数据库连接信息

# 6. 初始化数据库
cd apps/api-server
pnpm prisma:migrate

# 7. 启动开发服务器 (3 个终端)
# 终端 1: Python Worker
cd agents
$env:PYTHONPATH="src"
uv run python -m worker

# 终端 2: API Server
cd apps/api-server
pnpm dev

# 终端 3: Web 前端
cd apps/web
pnpm dev
```

## 项目结构

```
ai-voice/
├── apps/
│   ├── web/              # React 19 前端
│   └── api-server/       # NestJS 11 后端
├── agents/               # Python 3.12 Agent 引擎
├── packages/
│   ├── shared/           # 共享 TypeScript 类型
│   └── eslint-config/    # 共享 ESLint 配置
├── docker/               # Docker Compose 配置
└── docs-landing/         # 文档索引页
```

详细架构说明参见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 开发流程

### 1. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/bug-description
```

### 2. 编写代码

- **TypeScript**: 遵循项目 ESLint 配置 (单引号、2 空格缩进、尾逗号)
- **Python**: 遵循 PEP 8 规范,使用 ruff 格式化
- **提交信息**: 使用 Conventional Commits 格式

```bash
# 示例提交信息
feat: add multi-agent collaboration mode
fix: resolve memory leak in vector store
docs: update API documentation
refactor: simplify chat controller logic
test: add unit tests for message service
```

### 3. 运行测试

```bash
# TypeScript 测试
pnpm test

# Python 测试
cd agents
uv run pytest

# 类型检查
pnpm typecheck

# 代码规范检查
pnpm lint
```

### 4. 提交代码

```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

- 目标分支: `main`
- 标题: 使用 Conventional Commits 格式
- 描述: 说明改动目的、测试方法、相关 issue

## Changeset 版本管理

本项目使用 [Changesets](https://github.com/changesets/changesets) 管理版本发布。

### 何时需要 Changeset

- 修改了 `packages/shared` 的导出类型
- 修改了 `apps/api-server` 的 API 接口
- 修改了 `apps/web` 的组件 Props
- 任何影响公共 API 的改动

### 如何创建 Changeset

```bash
pnpm changeset
```

按提示选择:
1. 受影响的包 (可多选)
2. 版本类型 (major/minor/patch)
3. 改动描述

生成的 `.changeset/*.md` 文件需要提交到仓库。

### 版本发布流程

```bash
# 1. 消费所有 changeset,更新版本号
pnpm changeset:version

# 2. 提交版本变更
git add .
git commit -m "chore: version packages"
git push

# 3. 发布到 npm (仅当包为 public 时)
pnpm changeset:publish

# 4. 推送 git tags
git push --tags
```

**注意**: 当前所有包均为 `private: true`,`changeset:publish` 仅执行版本号和 git tag,不发布到 npm。

## 文档构建

### 前端组件文档 (Storybook)

```bash
cd apps/web
pnpm storybook
# 访问 http://localhost:6006
```

### TypeScript API 文档 (TypeDoc)

```bash
# api-server API 文档
pnpm --filter @ai-voice/api-server docs:typedoc
# 输出: apps/api-server/docs/typedoc/

# shared 类型文档
pnpm --filter @ai-voice/shared docs:typedoc
# 输出: packages/shared/docs/typedoc/
```

### NestJS 架构图 (Compodoc)

```bash
pnpm --filter @ai-voice/api-server docs:compodoc
# 输出: apps/api-server/docs/compodoc/
```

### Python API 文档 (MkDocs)

```bash
cd agents
uv run --group docs mkdocs serve
# 访问 http://127.0.0.1:8000
```

### 构建所有文档

```bash
pnpm docs
# 依次构建 web/api-server/shared 的文档
# Python 文档需在 agents/ 目录单独构建
```

### 文档部署

推送到 `main` 分支后,GitHub Actions 会自动:
1. 构建所有文档站
2. 部署到 GitHub Pages
3. 访问 `https://your-org.github.io/ai-voice/` 查看

## Husky Git Hooks

项目使用 Husky 自动化 Git 工作流:

- **pre-commit**: 运行 lint-staged,自动格式化和 ESLint 修复
- **commit-msg**: 验证提交信息格式 (Conventional Commits)

如需跳过 hooks (不推荐):

```bash
git commit --no-verify -m "your message"
```

## 代码规范

### TypeScript

- **引号**: 单引号
- **缩进**: 2 空格
- **尾逗号**: 所有位置
- **行宽**: 100 字符
- **分号**: 必须
- **类型**: 严格模式 (`strict: true`)

### Python

- **格式化**: ruff (PEP 8)
- **类型注解**: 推荐使用
- **Docstring**: Google 风格
- **行宽**: 100 字符

### 命名约定

- **TypeScript**: camelCase (变量/函数), PascalCase (类/接口/类型)
- **Python**: snake_case (变量/函数), PascalCase (类)
- **文件**: kebab-case (TypeScript), snake_case (Python)

## 常见问题

### Q: 如何添加新的 LLM Provider?

A: 在 `agents/src/models/provider.py` 中添加新的 Provider 类,实现 `BaseChatModel` 接口。

### Q: 如何添加新的内置技能?

A: 在 `agents/src/skills/registry.py` 中添加新的 `Skill` 实例,并在 `apps/api-server/src/modules/skills/skills.service.ts` 同步更新。

### Q: 如何添加新的 MCP 服务器?

A: 通过 `apps/api-server` 的 `/api/mcp/servers` API 创建,或在数据库中直接插入 `mcp_servers` 表记录。

### Q: 如何调试 Agent 引擎?

A: 设置环境变量 `LOG_LEVEL=debug`,Agent 会输出详细的执行日志。

## 联系与支持

- **Issue**: 在 GitHub 仓库提交 issue
- **Discussion**: 使用 GitHub Discussions 讨论功能需求
- **Security**: 安全问题请通过邮件私下报告

## 许可证

本项目采用 MIT 许可证,详见 [LICENSE](./LICENSE) 文件。
