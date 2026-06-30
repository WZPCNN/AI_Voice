# 文档工具依赖安装与验证计划

## 摘要

所有文档配置文件已就位（package.json 脚本、turbo.json 任务、typedoc.json、mkdocs.yml、.storybook 配置、CI/CD workflow、landing page、README），但 Python docs 依赖因 uv 锁文件冲突未能安装成功。本计划解决锁文件问题，完成依赖安装，逐一验证每个文档工具可正常构建。

## 当前状态分析

### 已完成（配置层面）

| 组件 | 状态 | 说明 |
|------|------|------|
| 根 package.json | ✅ | `docs`、`changeset:*` 脚本已添加 |
| turbo.json | ✅ | `docs` 任务已配置 (dependsOn: ^build, outputs: docs/\*\*, storybook-static/\*\*, site/\*\*) |
| apps/web | ✅ | Storybook 9 依赖 + scripts (storybook/build-storybook/docs) + .storybook/main.ts + preview.ts |
| apps/api-server | ✅ | typedoc 0.28.19 + compodoc 1.2.1 依赖 + typedoc.json + scripts |
| packages/shared | ✅ | typedoc 0.28.19 依赖 + typedoc.json + scripts |
| agents/pyproject.toml | ✅ | docs 依赖组 (mkdocs>=1.6, mkdocs-material==9.7.\*, mkdocstrings[python]>=0.29) |
| .github/workflows/docs.yml | ✅ | 完整 CI/CD 流水线 |
| docs-landing/index.html | ✅ | 分流索引页 |
| README.md | ✅ | 已更新文档章节 |
| .gitignore | ✅ | 已忽略文档构建产物 |
| agents/mkdocs.yml + docs/\*.md | ✅ | MkDocs 配置 + 3 个文档页 |

### 待解决问题

1. **uv 锁文件阻塞**: `agents/.venv/.lock` 残留（12:17:56 创建），且有一个 uv 进程 (PID 24380) 从 12:02:43 运行至今，导致 `uv sync --group docs` 等待锁超时（300s）后失败
2. **MkDocs 未安装**: 因锁文件问题，docs 依赖组未成功安装
3. **Node.js 依赖未验证**: 新增的 Storybook/TypeDoc/Compodoc 依赖是否已安装到 node_modules 需确认
4. **文档工具未验证**: 没有任何一个文档工具实际运行过构建

## 实施步骤

### 步骤 1: 清理 uv 锁文件冲突

1. 终止残留的 uv 进程 (PID 24380)
2. 删除 `agents/.venv/.lock` 文件
3. 验证无其他 uv 进程占用

### 步骤 2: 安装 Python docs 依赖

```bash
cd agents
uv sync --group docs
```

验证: `uv run --group docs mkdocs --version` 输出版本号

### 步骤 3: 确认 Node.js 依赖已安装

```bash
pnpm install
```

如果 pnpm-lock.yaml 已是最新则无需 `--no-frozen-lockfile`；否则需要更新 lockfile。

验证: `node_modules/storybook`、`node_modules/.pnpm/typedoc@*`、`node_modules/.pnpm/@compodoc+compodoc@*` 存在

### 步骤 4: 逐一验证文档工具

按以下顺序验证，每个工具构建后检查输出目录是否存在：

#### 4a. TypeDoc (shared) — 最简单，先验证
```bash
pnpm --filter @ai-voice/shared docs:typedoc
```
预期输出: `packages/shared/docs/typedoc/` 目录

#### 4b. TypeDoc (api-server)
```bash
pnpm --filter @ai-voice/api-server docs:typedoc
```
预期输出: `apps/api-server/docs/typedoc/` 目录

#### 4c. Compodoc (api-server) — 容错，TS 6.0 兼容性不确定
```bash
pnpm --filter @ai-voice/api-server docs:compodoc
```
预期输出: `apps/api-server/docs/compodoc/` 目录
如果失败: 记录错误，不影响整体流程（CI 已设 continue-on-error: true）

#### 4d. Storybook (web)
```bash
pnpm --filter @ai-voice/web build-storybook
```
预期输出: `apps/web/storybook-static/` 目录

#### 4e. MkDocs (agents)
```bash
cd agents && uv run --group docs mkdocs build
```
预期输出: `agents/site/` 目录

### 步骤 5: 回归验证

确保文档依赖的添加没有引入 regression:
```bash
pnpm typecheck
pnpm lint
pnpm test
```

### 步骤 6: 更新项目文档（如有必要）

如果验证过程中发现配置需要调整（如 typedoc.json 入口点错误、mkdocs.yml 配置问题），修复后更新对应文档。

## 假设与决策

- **Compodoc 可能失败**: Compodoc 1.2.1 对 TS 6.0 的兼容性不确定，CI 已配置 `continue-on-error: true`，本地验证失败也可接受
- **MkDocs site_url 留空**: mkdocs.yml 中 `site_url: ""` 和 `repo_url: ""` 是故意的，CI 中通过 `MKDOCS_SITE_URL` 环境变量注入
- **Storybook base path**: `.storybook/main.ts` 通过 `DOCS_BASE_PATH` 环境变量控制，CI 注入，本地构建默认 `/`
- **不创建 stories 文件**: 之前的会话已创建了 4 个 stories 文件（MessageBubble、SlashCommandPalette、ModelSelector、Sidebar）

## 验证清单

- [ ] uv 锁文件已清理，`uv sync --group docs` 成功
- [ ] `mkdocs --version` 可执行
- [ ] `pnpm install` 无报错
- [ ] TypeDoc (shared) 构建成功，`packages/shared/docs/typedoc/` 存在
- [ ] TypeDoc (api-server) 构建成功，`apps/api-server/docs/typedoc/` 存在
- [ ] Compodoc 构建成功或已知失败原因（容错）
- [ ] Storybook 构建成功，`apps/web/storybook-static/` 存在
- [ ] MkDocs 构建成功，`agents/site/` 存在
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 通过
