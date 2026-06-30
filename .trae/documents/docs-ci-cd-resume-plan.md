# 文档体系 + CI/CD 自动部署集成计划(Resume 版)

## Context(背景)

AIVoice monorepo 当前文档体系薄弱:根 README 目录结构严重过时(标注 `engine/`/`planner/`/`pgvector`,实际为 `worker.py`/`orchestrator.py`/`Qdrant`;只文档化 3 种模式,实际 [types/index.ts:166](file:///d:\MyProject\AIVoice\packages\shared\src\types\index.ts#L166) 定义 5 种 AppMode),4 个子包无 README,无 ARCHITECTURE/CONTRIBUTING。同时无任何文档工具(Storybook/TypeDoc/Compodoc/MkDocs),CI 流水线虽成熟(GitHub Actions ci.yml + changesets 已集成)但无文档构建/部署。

本计划目标:更新过时文档 + 集成 4 类文档工具(前端 Storybook、后端 TypeDoc+Compodoc、Python MkDocs Material+mkdocstrings、changeset publish 补全) + turbo docs task + GitHub Actions 自动部署到 GitHub Pages,形成"push main → 自动构建所有文档站 → 部署"的闭环。

## 用户决策(已确认)

- CI/CD 部署:**GitHub Pages 自动部署**(用 `actions/deploy-pages@v4` 现代方案,非 gh-pages 分支)
- Python 文档:**MkDocs Material + mkdocstrings[python]**(锁 material 9.7.* 规避 2025-11 维护模式风险)
- 后端文档:**TypeDoc + Compodoc**(TypeDoc 出 TS API 参考,Compodoc 出 NestJS 架构图)
- 前端文档:**Storybook**(React 19 + Vite 8)

## 架构真相(Phase 1 探查已验证)

通过 Explore agent 实地核查确认:

- **AppMode 5 种**:[types/index.ts:166](file:///d:\MyProject\AIVoice\packages\shared\src\types\index.ts#L166) `'multi' | 'plan' | 'exec' | 'skills' | 'mcp'`(README 现仅 3 种)
- **向量库是 Qdrant** 非 pgvector([agents/pyproject.toml](file:///d:\MyProject\AIVoice\agents\pyproject.toml) `qdrant-client==1.18.0`)
- **agents/src/ 实际结构**(已验证):顶层 `worker.py`/`runner.py`/`prompt_architect.py`/`decomposer.py`/`executor.py`/`orchestrator.py`/`logger.py`/`tools.py`/`json_utils.py` + 子包 `memory/`(embeddings/vector_store/manager)、`skills/`(registry)、`mcp_client/`(client)、`prompts/`(system/tools/capabilities/identity)、`models/`(provider)。README 的 `engine/`/`planner/`/`multi_agent/` 已不存在
- **技术栈版本**:React 19.2.7(非 18)、NestJS 11.1.27(非 10)、TypeScript 6.0、Tailwind 4.3、Vite 8.1
- **现有 CI**:`.github/workflows/ci.yml`(单文件)
- **现有 changeset**:`.changeset/config.json` 存在,`commit: false`、`access: restricted`、`baseBranch: main`、`updateInternalDependencies: patch`、ignore `@ai-voice/eslint-config`
- **apps/web/src 组件**:`chat/` 10 个 .tsx(AgentCard/ChatInput/McpServersPanel/MessageBubble/MessageList/ModelSelector/PlanSection/PlanTemplate/SkillsSelector/SlashCommandPalette)、`components/` 3 个(AuthGuard/Layout/Sidebar)
- **packages/shared/src**:`index.ts`、`schema.sql`、`types/index.ts`(无构建,源码直接导出)
- **api-server/src/modules/**:7 个模块(auth/chat/mcp/message/model-config/session/skills)
- **agents/pyproject.toml [dependency-groups]**:仅 `dev = [pytest, pytest-asyncio, ruff, mypy]`,无 docs 组
- **.gitignore**:未忽略 `storybook-static/`、`docs/`、`site/`、`*.nojekyll`
- **根 package.json scripts**:build/dev/lint/typecheck/test/format/format:check/spellcheck/changeset/changeset:version/prepare —— **缺 `changeset:publish` 和 `docs`**

---

## 工作流清单(9 项)

### 1. 文档更新(7 个文件)

| 文件 | 操作 | 关键内容 |
|------|------|----------|
| [README.md](file:///d:\MyProject\AIVoice\README.md) | 改 | 修目录结构(agents/src 实际 9 文件 + 5 子包)、3→5 种模式、技术栈版本(pgvector→Qdrant、React 18→19、NestJS 10→11)、新增"文档"章节(链接 Pages 各子站 + 本地命令)、新增"贡献"指向 CONTRIBUTING |
| `ARCHITECTURE.md` | 新建 | 全链路数据流(web→api-server→Redis pub/sub→worker→LLM)、组件职责(web/api-server/agents/shared)、基础设施(PG+Qdrant+Redis)、5 种模式详解、数据模型对应 |
| `CONTRIBUTING.md` | 新建 | 开发环境(pnpm 11.9 + Node 22 + uv + Python 3.12)、开发流程、Conventional Commits、Changeset 用法(含 publish 流程)、Husky 钩子说明、文档构建命令 |
| `apps/web/README.md` | 新建 | 概述(React 19+Vite 8+Tailwind 4)、目录结构(chat/10 组件 + components/3)、本地开发(端口 3000,代理 /api→4000)、Storybook 启动命令、核心组件清单 |
| `apps/api-server/README.md` | 新建 | 概述(NestJS 11+Prisma 7+Socket.io)、7 模块表(auth/chat/mcp/message/model-config/session/skills)、本地开发(prisma:generate→pnpm dev,端口 4000)、API 文档链接(TypeDoc+Compodoc)、环境变量清单 |
| `packages/shared/README.md` | 新建 | 概述(直接源码导出无构建)、导出类型清单(AppMode/Message/PlanStep/ChatChunk/SkillInfo/McpServerConfig)、workspace:* 用法 |
| `agents/README.md` | 新建 | 概述(Python 3.12+LangGraph+uv)、目录结构(9 文件 + 5 子包)、本地开发(uv sync/pytest/worker 启动)、MkDocs 文档命令、内置技能(skills+mcp_client) |

### 2. Storybook 集成(apps/web)

**新建文件**:
- `apps/web/.storybook/main.ts` — stories glob `../src/**/*.stories.tsx`、framework `@storybook/react-vite`、addons `@storybook/addon-themes`、`viteFinal` 设 `config.base = process.env.DOCS_BASE_PATH ?? '/'`(CI 子路径部署)
- `apps/web/.storybook/preview.ts` — `import '../src/index.css'`(含 `@import "tailwindcss"` + .ProseMirror/.streaming-cursor 自定义样式,PostCSS 自动发现)
- `apps/web/src/chat/MessageBubble.stories.tsx`、`SlashCommandPalette.stories.tsx`、`ModelSelector.stories.tsx`、`apps/web/src/components/Sidebar.stories.tsx`(4 个核心 stories,与组件同级)

**修改**:[apps/web/package.json](file:///d:\MyProject\AIVoice\apps\web\package.json) devDependencies 加 `storybook@^9.1`、`@storybook/react-vite@^9.1`、`@storybook/addon-themes@^9.1`;scripts 加 `storybook`(`storybook dev -p 6006`)、`build-storybook`(`storybook build -o storybook-static`)、`docs`(=`build-storybook`)

**关键**:不装 `@storybook/addon-essentials`(Storybook 9 已将 controls/actions/viewport/docs 并入核心);React 19 在 8.5+ 已支持

### 3. TypeDoc 集成(apps/api-server + packages/shared)

**新建文件**:
- `apps/api-server/typedoc.json` — `entryPointStrategy: "expand"`、`entryPoints: ["src"]`、`exclude: ["**/*.test.ts"]`、`out: "docs/typedoc"`、`tsconfig: "tsconfig.json"`、`githubPages: true`(生成 .nojekyll)、`excludePrivate: true`
- `packages/shared/typedoc.json` — `entryPoints: ["src/index.ts"]`、`out: "docs/typedoc"`、`githubPages: true`

**修改**:两个包 package.json devDependencies 加 `typedoc@^0.28.19`(0.28.18+ 支持 TS 6.0);scripts 加 `docs:typedoc`(=`typedoc`)、`docs`(=`docs:typedoc`,shared 独占;api-server 见工作流 4)

### 4. Compodoc 集成(apps/api-server)

**修改**:[apps/api-server/package.json](file:///d:\MyProject\AIVoice\apps\api-server\package.json) devDependencies 加 `@compodoc/compodoc@^1.2.1`(若 TS 6.0 失败改 `^2.0.0`);scripts 加 `docs:compodoc`(`compodoc -p tsconfig.json -d docs/compodoc`);`docs` 改为 `pnpm docs:typedoc && pnpm docs:compodoc`

**风险(最高)**:Compodoc 自带 TS 解析器,1.2.1 对 TS 6.0 兼容性未确认。验证策略:集成后立即本地跑,失败升级 2.0.0,再失败则弃用(TypeDoc 独担),CI 用 `continue-on-error: true` 容错

### 5. MkDocs Material + mkdocstrings(agents)

**修改**:[agents/pyproject.toml](file:///d:\MyProject\AIVoice\agents\pyproject.toml) 加 `[dependency-groups] docs = ["mkdocs>=1.6,<2", "mkdocs-material==9.7.*", "mkdocstrings[python]>=0.29"]`(锁 material 9.7.* 规避维护模式)

**新建文件**:
- `agents/mkdocs.yml` — site_name: Agent Engine、theme: material(暗/亮切换+tabs)、plugins: mkdocstrings(`docstring_style: google`)、nav(首页/架构/API 参考)
- `agents/docs/index.md` — 项目概述
- `agents/docs/architecture.md` — worker/runner/orchestrator 流程 + memory/skills/mcp_client 子包
- `agents/docs/api.md` — 用 `::: src.skills.registry`、`::: src.mcp_client.client`、`::: src.memory.manager`、`::: src.orchestrator` 等 mkdocstrings 自动抽取

**命令**:`cd agents && uv sync --group docs`、`uv run --group docs mkdocs serve`(8000)、`uv run --group docs mkdocs build`(输出 site/)

### 6. changeset:publish 脚本补全

**修改**:[package.json](file:///d:\MyProject\AIVoice\package.json) scripts 加 `"changeset:publish": "changeset publish"`

**约定**(写入 CONTRIBUTING):apps/web、apps/api-server、packages/shared 均 `private: true`,changeset:publish 实质只做 versioning + git tag(不发布 npm)。若未来要 npm 发布,需移除 private 并加 publishConfig

### 7. turbo docs task

**修改**:
- [turbo.json](file:///d:\MyProject\AIVoice\turbo.json) 加 `"docs": { "dependsOn": ["^build"], "outputs": ["docs/**", "storybook-static/**", "site/**"] }`
- [package.json](file:///d:\MyProject\AIVoice\package.json) scripts 加 `"docs": "turbo run docs"`

**说明**:agents(Python)不在 turbo 体系,CI 单独跑

### 8. GitHub Actions docs workflow(核心)

**新建**:`.github/workflows/docs.yml`

**触发**:`push: branches: [main]` + `workflow_dispatch`

**权限**:`contents: read`、`pages: write`、`id-token: write`

**Jobs**(单 build + 单 deploy):
- **build job**:checkout → pnpm 11.9 + Node 22 + Python 3.12 + uv → `pnpm install --frozen-lockfile` → `prisma:generate` → `actions/configure-pages@v5`(输出 base_path/base_url)→
  1. Storybook:`pnpm --filter @ai-voice/web build-storybook`(env `DOCS_BASE_PATH=<base>storybook/`)→ cp 到 `site/storybook/`
  2. TypeDoc:api-server + shared 各 `docs:typedoc` → cp 到 `site/typedoc-api/`、`site/typedoc-shared/`
  3. Compodoc:`docs:compodoc`(`continue-on-error: true` 容错)→ cp 到 `site/compodoc/`
  4. Python:`cd agents && uv sync --group docs` → `mkdocs build`(env `MKDOCS_SITE_URL`)→ cp 到 `site/python/`
  5. 根索引:`cp docs-landing/index.html site/index.html`
  6. `actions/upload-pages-artifact@v3`(path: site)
- **deploy job**:`actions/deploy-pages@v4`,environment: github-pages

**新建**:`docs-landing/index.html`(卡片式分流入口,相对路径链接 `./storybook/`、`./typedoc-api/`、`./typedoc-shared/`、`./compodoc/`、`./python/`)

**修改**:`.gitignore` 追加 `apps/web/storybook-static/`、`apps/api-server/docs/`、`packages/shared/docs/`、`agents/site/`、`site/`

### 9. GitHub Pages 目录结构

```
site/(deploy-pages 部署的 artifact)
├── index.html          ← 分流索引(docs-landing/index.html)
├── storybook/          ← 前端组件库
├── typedoc-api/        ← api-server TS API
├── typedoc-shared/     ← shared 类型参考
├── compodoc/           ← api-server NestJS 架构图(可选,失败则缺)
└── python/             ← agents Python API(MkDocs)
```

URL(项目页 base = /<repo>/):`/<repo>/`、`/<repo>/storybook/`、`/<repo>/typedoc-api/`、`/<repo>/typedoc-shared/`、`/<repo>/compodoc/`、`/<repo>/python/`

仓库 Settings → Pages → Source 必须选 **"GitHub Actions"**(非分支)

---

## 执行顺序

**Phase 1(可全部并行,互不依赖)**:
- 工作流 6(changeset:publish,2 分钟)
- 工作流 2(Storybook)
- 工作流 3(TypeDoc)
- 工作流 4(Compodoc)—— **完成后立即本地验证 TS 6.0,决定去留**
- 工作流 5(MkDocs)
- 工作流 1 的 7 个文档文件(不依赖工具)

**Phase 2(依赖 Phase 1 的 per-package docs script)**:
- 工作流 7(turbo docs task)
- 工作流 1 的根 README 更新(反映文档工具 + 链接)

**Phase 3(依赖 Phase 1/2 本地验证通过)**:
- 工作流 8(docs.yml + .gitignore)
- 工作流 9(Pages 结构 + docs-landing/index.html)

**串行关键路径**:工作流 4 验证 →(若 Compodoc 失败,docs.yml 跳过)→ 工作流 7 → 工作流 8

---

## 风险清单

| 风险 | 等级 | 缓解 |
|------|------|------|
| Compodoc + TS 6.0 不兼容 | 高 | 本地先验证;1.2.1 失败转 2.0.0;再失败弃用,TypeDoc 独担;CI `continue-on-error` |
| Storybook + Vite 8(Rolldown) | 中 | 本地 `storybook dev` + `build-storybook` 双测;失败临时降 Vite 7 定位 |
| Storybook 子路径部署白屏 | 中 | `viteFinal` 设 base;失败则 Storybook 占 Pages 根,其余子路径 |
| MkDocs Material 维护模式 | 低 | 锁 9.7.* 规避;12 个月稳定,长期评估 Zensical |
| Tailwind v4 在 Storybook | 低 | PostCSS 自动发现;失效则 `viteFinal` 显式配 `css.postcss` |

---

## 验证步骤

### 本地验证(推 CI 前)

```bash
# 1. Storybook
pnpm --filter @ai-voice/web storybook          # http://localhost:6006,Tailwind 生效
pnpm --filter @ai-voice/web build-storybook    # 产 storybook-static/

# 2. TypeDoc
pnpm --filter @ai-voice/api-server docs:typedoc  # 产 docs/typedoc/
pnpm --filter @ai-voice/shared docs:typedoc      # 产 docs/typedoc/

# 3. Compodoc(验证 TS 6.0,决定去留)
pnpm --filter @ai-voice/api-server docs:compodoc # 产 docs/compodoc/

# 4. Python MkDocs
cd agents && uv sync --group docs
uv run --group docs mkdocs build                 # 产 site/
uv run --group docs mkdocs serve                 # http://127.0.0.1:8000

# 5. Turbo 聚合
pnpm docs                                        # 依次跑 web/api-server/shared

# 6. 现有 CI 不回归
pnpm typecheck && pnpm lint && pnpm test
```

### CI 验证(推 main 后)

1. GitHub Actions 观察 Docs workflow,build job 全绿(Compodoc 步骤可黄)
2. 仓库 Settings → Pages 确认 Source = GitHub Actions,获取 URL
3. 访问 `https://<owner>.github.io/<repo>/` 看分流索引
4. 逐一点击 storybook/typedoc-api/typedoc-shared/compodoc/python 子站,确认资源无 404

### 现有 CI 不回归

```bash
pnpm --filter @ai-voice/api-server typecheck
pnpm --filter @ai-voice/api-server lint
pnpm --filter @ai-voice/api-server test          # 62 测试仍全绿
pnpm --filter @ai-voice/web typecheck
pnpm --filter @ai-voice/web build
cd agents && uv run pytest
```

---

## Assumptions & Decisions

1. **GitHub Pages base path 由 `actions/configure-pages@v5` 动态推断**,不硬编码仓库名
2. **Storybook 9 不需要 addon-essentials**(已并入核心)
3. **Compodoc 是高风险项**,CI 用 `continue-on-error` 容错,失败不影响其他文档站部署
4. **MkDocs Material 锁 9.7.***,规避 2025-11 进入维护模式后的迁移风险
5. **changeset:publish 实质只做 versioning + git tag**(因所有包 private: true),写入 CONTRIBUTING 说明
6. **agents(Python)不在 turbo 体系**,CI 单独跑 mkdocs build
7. **本地验证是推 CI 的硬性前置**,特别是 Compodoc + TS 6.0、Storybook + Vite 8 两个高风险点
8. **不修改任何现有源码逻辑**,只新增文档工具配置和文档文件;现有 62 个测试必须保持全绿
