 # Repository Guidelines
 
 ## 项目结构与模块组织
 
 本仓库是基于 pnpm + Turborepo 的 monorepo，所有源码按模块分布在以下目录：
 
 - `packages/` — 共享库，如 `shared`（通用类型与工具）、`eslint-config`（ESLint 配置）
 - `apps/` — 独立应用，如 `api-server`（后端服务）、`web`（前端应用）
 - `agents/` — Python Agent 代码（基于 uv 管理依赖）
 - `.agents/skills/` — Feishu/Lark 集成技能
 - `workflows/` — 工作流相关代码
 
 测试文件与源码同级，命名为 `*.test.ts` 或 `*.spec.ts`。配置文件（如 `tsconfig.json`、`.prettierrc`）位于仓库根目录。
 
 ## 构建、测试与开发命令
 
 所有命令通过根目录 `package.json` 的 scripts 统一调度：
 
 | 命令 | 说明 |
 |------|------|
 | `pnpm install` | 安装所有依赖 |
 | `pnpm build` | 通过 Turborepo 并行构建所有包 |
 | `pnpm dev` | 启动本地开发服务器（热更新） |
 | `pnpm test` | 运行所有测试套件 |
 | `pnpm lint` | 运行 ESLint 检查 |
 | `pnpm typecheck` | 执行 TypeScript 类型检查 |
 | `pnpm format` | 使用 Prettier 格式化代码 |
 | `pnpm spellcheck` | 使用 cspell 检查拼写 |
 
 针对特定包运行命令：`pnpm --filter @project/package-name <command>`。
 
 ## 编码风格与命名规范
 
 - **缩进**：2 空格，禁止使用 Tab
 - **引号**：单引号（Prettier 配置 `singleQuote: true`）
 - **行尾逗号**：所有位置均添加尾逗号
 - **打印宽度**：100 字符
 - **语言**：TypeScript 严格模式（`tsconfig.json` 中 `strict: true`）
 - **命名**：变量/函数/方法使用 `camelCase`；类/类型/接口使用 `PascalCase`；文件名使用 `kebab-case`（如 `agent-runner.ts`）
 - **格式化**：Prettier 自动格式化，提交前通过 lint-staged 强制执行
 - **拼写检查**：cspell 检查 Markdown 和 TypeScript 文件中的拼写
 
 ## 测试指南
 
 - **框架**：Vitest（单元测试与集成测试）
 - **覆盖率**：新增代码覆盖率目标 80%+，通过 `pnpm test --coverage` 验证
 - **命名**：测试文件与源码路径对应，后缀为 `.test.ts`（如 `workflow/engine.test.ts`）
 - **结构**：使用 `describe` 分组关联用例，优先描述行为而非实现细节
 
 ## 提交与 Pull Request 规范
 
 - **提交信息**：使用 Conventional Commits 格式（`feat:`、`fix:`、`chore:`、`refactor:`、`docs:`），保持简洁、一般现在时
 - **Pull Request**：每个 PR 需包含变更摘要、关联 issue 链接、相关测试结果。UI 变更需附截图
 - **提交前检查**：lint-staged 自动对暂存文件运行 ESLint 和 Prettier
 
 ## Agent 特定说明
 
 本仓库通过 `lark-cli`（飞书 CLI）集成 Feishu/Lark 能力：
 
 - 调用任何 lark-* skill 前，使用 `--as` 指定正确的身份
 - 每个环境的配置独立存储，禁止提交到版本控制
 - 扩展 Agent 能力时，在 `.agents/skills/` 下按现有 skill 模板添加新技能
 
 ## 目录布局（参考）
 
 ```
 .
 ├── apps/
 │   ├── api-server/          # 后端服务
 │   └── web/                 # 前端应用
 ├── packages/
 │   ├── shared/              # 共享类型与工具
 │   └── eslint-config/       # ESLint 共享配置
 ├── agents/                  # Python Agent 代码
 ├── .agents/skills/          # Feishu/Lark 技能
 ├── workflows/               # 工作流代码
 ├── package.json             # 根 package.json
 ├── pnpm-workspace.yaml      # pnpm workspace 配置
 ├── tsconfig.json            # TypeScript 配置
 └── .prettierrc              # Prettier 配置
 ```
