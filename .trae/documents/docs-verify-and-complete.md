# 文档工具验证与完成计划

## 背景

文档 CI/CD 集成的所有文件修改和新建工作已完成（配置文件、文档文件、Storybook/TypeDoc/Compodoc/MkDocs 配置、CI workflow 等），Python 侧 MkDocs 依赖已通过 `uv sync --group docs` 安装成功（`agents/.venv/Scripts/mkdocs.exe` 已存在）。但 Node.js 侧新增的依赖（Storybook、TypeDoc、Compodoc）尚未安装到 node_modules，需要执行 `pnpm install` 并逐一验证每个文档工具能否成功构建。

## 当前状态

### ✅ 已完成
- 所有 package.json 已修改（根/web/api-server/shared 的 scripts + devDependencies）
- turbo.json 已添加 docs task
- `.github/workflows/docs.yml` CI/CD 工作流已创建
- `docs-landing/index.html` 分流索引页已创建
- `.gitignore` 已追加文档产物忽略规则
- Storybook 配置（`.storybook/main.ts` + `preview.ts`）+ 4 个 stories 文件已创建
- TypeDoc 配置（`apps/api-server/typedoc.json` + `packages/shared/typedoc.json`）已创建
- MkDocs 配置（`agents/mkdocs.yml`）+ 3 个文档页面已创建
- Python 依赖已安装（`agents/.venv/Scripts/mkdocs.exe` 已存在）
- pnpm-lock.yaml 已更新（包含新依赖）
- 文档文件（README/ARCHITECTURE/CONTRIBUTING/子包 README）已创建

### ❌ 待完成
- Node.js 新依赖未安装（storybook/typedoc/@compodoc/compodoc 不在 node_modules 中）
- 各文档工具未验证构建
- 未运行 typecheck/lint/test 回归检查

## 执行步骤

### Step 1: 安装 Node.js 依赖
```bash
pnpm install
```
更新 lockfile 并将 Storybook 9、TypeDoc 0.28.19、Compodoc 1.2.1 安装到 node_modules。

### Step 2: 验证 MkDocs（Python）
```bash
cd agents && uv run --group docs mkdocs build
```
- 预期产物：`agents/site/` 目录
- 风险：低（MkDocs Material 9.7 + mkdocstrings 已安装成功）
- 若失败：检查 `agents/docs/api.md` 中 mkdocstrings 引用路径是否正确

### Step 3: 验证 TypeDoc（api-server）
```bash
pnpm --filter @ai-voice/api-server docs:typedoc
```
- 预期产物：`apps/api-server/docs/typedoc/`
- 风险：中（TS 6.0 + TypeDoc 0.28.19，需 0.28.18+ 支持 TS 6.0）
- 若失败：检查 typedoc.json 配置，确认 entryPoints/exclude 路径

### Step 4: 验证 TypeDoc（shared）
```bash
pnpm --filter @ai-voice/shared docs:typedoc
```
- 预期产物：`packages/shared/docs/typedoc/`
- 风险：低

### Step 5: 验证 Compodoc（api-server）
```bash
pnpm --filter @ai-voice/api-server docs:compodoc
```
- 预期产物：`apps/api-server/docs/compodoc/`
- 风险：**高**（Compodoc 1.2.1 自带 TS 解析器，对 TS 6.0 兼容性未确认）
- 若失败：
  1. 尝试升级到 `@compodoc/compodoc@^2.0.0`
  2. 若仍失败，弃用 Compodoc（TypeDoc 独担），从 `docs` script 中移除 `docs:compodoc`
  3. CI 已有 `continue-on-error: true` 容错

### Step 6: 验证 Storybook 构建
```bash
pnpm --filter @ai-voice/web build-storybook
```
- 预期产物：`apps/web/storybook-static/`
- 风险：中（Storybook 9 + Vite 8 + React 19 + Tailwind 4）
- 若失败：
  1. 检查 `.storybook/main.ts` 的 framework/addons 配置
  2. 检查 Tailwind 4 PostCSS 是否正确加载
  3. 查看 stories 文件是否有导入错误

### Step 7: 回归检查 — typecheck
```bash
pnpm typecheck
```
确保新增的 devDependencies 不影响类型检查。

### Step 8: 回归检查 — lint
```bash
pnpm lint
```
确保新增的 stories 文件和配置通过 ESLint。

### Step 9: 回归检查 — test
```bash
pnpm test
```
确保 62 个测试仍然全部通过。

### Step 10: 清理临时文件
删除 `_test_write.txt`（git status 中发现的未跟踪文件，疑似测试残留）。

## 风险清单

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Compodoc + TS 6.0 不兼容 | 高 | 升级 2.0.0 → 弃用 → CI 已设 continue-on-error |
| Storybook + Vite 8 (Rolldown) | 中 | 检查构建输出，必要时调整 viteFinal 配置 |
| TypeDoc entryPoints 配置错误 | 低 | 检查 typedoc.json，调整 entryPoints |
| pnpm install 网络/锁文件冲突 | 低 | 使用 `--no-frozen-lockfile` |

## 验证标准

全部完成后，以下命令必须全部成功：
1. `pnpm --filter @ai-voice/web build-storybook` → 产出 `storybook-static/`
2. `pnpm --filter @ai-voice/api-server docs:typedoc` → 产出 `docs/typedoc/`
3. `pnpm --filter @ai-voice/shared docs:typedoc` → 产出 `docs/typedoc/`
4. `cd agents && uv run --group docs mkdocs build` → 产出 `site/`
5. `pnpm typecheck` → 无错误
6. `pnpm lint` → 无错误
7. `pnpm test` → 62 测试全绿
