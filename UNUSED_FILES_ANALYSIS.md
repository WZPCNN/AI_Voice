# 项目未使用文件和配置分析报告

生成时间：2026-06-30  
分析范围：整个 AIVoice 项目

---

## 一、构建产物被 Git 跟踪（严重）

以下构建产物目录被 Git 跟踪，应该添加到 `.gitignore` 并从版本控制中移除：

### 1.1 前端构建产物

- `apps/web/dist/` - Vite 构建输出目录
- `apps/web/storybook-static/` - Storybook 静态文档站点
- `apps/web/.turbo/` - Turborepo 缓存目录

### 1.2 后端构建产物

- `apps/api-server/dist/` - NestJS 编译输出目录
- `apps/api-server/docs/` - 文档生成目录（TypeDoc + Compodoc）
- `apps/api-server/.turbo/` - Turborepo 缓存目录

### 1.3 共享包构建产物

- `packages/shared/dist/` - TypeScript 编译输出目录
- `packages/shared/docs/` - TypeDoc 文档生成目录
- `packages/shared/.turbo/` - Turborepo 缓存目录

### 修复建议

在 `.gitignore` 中添加：

```gitignore
# Build outputs
apps/web/dist/
apps/web/storybook-static/
apps/api-server/dist/
apps/api-server/docs/
packages/shared/dist/
packages/shared/docs/

# Turbo cache
**/.turbo/
```

然后从 Git 中移除这些文件：

```bash
git rm -r --cached apps/web/dist apps/web/storybook-static apps/api-server/dist apps/api-server/docs packages/shared/dist packages/shared/docs
git rm -r --cached apps/web/.turbo apps/api-server/.turbo packages/shared/.turbo
git commit -m "chore: remove build artifacts from git tracking"
```

**风险评估**：低风险。这些文件可以通过 `pnpm build` 和 `pnpm docs` 重新生成。

---

## 二、前端未使用的源代码文件

### 2.1 useConversations Hook（中等风险）

**文件**：`apps/web/src/hooks/useConversations.ts`

**问题**：该 Hook 定义了会话列表管理功能（创建、删除、重命名会话），但在整个前端代码中没有任何地方导入或使用它。

**分析**：

- 该 Hook 导出了 `useConversations` 函数
- 搜索整个 `apps/web/src` 目录，没有找到任何导入语句
- 相关功能可能在其他组件中直接实现（如 `Sidebar.tsx`）

**建议**：

1. 检查 `Sidebar.tsx` 是否已经有类似的会话管理逻辑
2. 如果功能已实现，删除此文件
3. 如果功能未实现但计划使用，保留文件并添加 TODO 注释

**风险评估**：中等。需要确认功能是否在其他地方实现。

---

## 三、Tailwind CSS v4 配置文件（低风险）

**文件**：`apps/web/tailwind.config.js`

**问题**：项目使用 Tailwind CSS v4.3.1，该版本采用 CSS-first 配置方式，传统的 `tailwind.config.js` 可能不再需要。

**分析**：

- Tailwind v4 通过 `@import "tailwindcss"` 和 CSS 变量进行配置
- 当前配置文件只定义了 `content` 路径和空的 `theme.extend`
- `postcss.config.js` 中使用了 `@tailwindcss/postcss` 插件（v4 方式）

**建议**：

1. 验证删除 `tailwind.config.js` 后样式是否正常
2. 如果正常，删除该文件
3. 如需自定义主题，在 `apps/web/src/index.css` 中使用 CSS 变量

**风险评估**：低风险。可以先备份文件后尝试删除。

---

## 四、共享包中未使用的类型定义

以下类型在 `packages/shared/src/types/index.ts` 中定义，但在整个项目中没有被引用：

### 4.1 ProviderConfig 接口

```typescript
export interface ProviderConfig {
  label: string;
  models: string[];
}
```

**问题**：没有任何文件导入或使用此类型。

### 4.2 AgentPlan 接口

```typescript
export interface AgentPlan {
  id: string;
  sessionId: string;
  steps: PlanStep[];
  createdAt: string;
}
```

**问题**：没有任何文件导入或使用此类型。

### 4.3 ModelConfigPayload 接口

```typescript
export interface ModelConfigPayload {
  modelProvider: string;
  modelName: string;
  temperature: number;
  maxTokens?: number;
  tools?: string[];
  systemPrompt?: string;
  apiKey?: string;
  baseUrl?: string;
}
```

**问题**：没有任何文件导入或使用此类型。

### 4.4 Mode 常量对象

```typescript
export const Mode = {
  EXECUTE: 'execute',
  PLAN: 'plan',
  MULTI: 'multi',
} as const;
```

**问题**：

- 代码中使用的是字符串字面量（如 `'execute'`、`'plan'`）
- 没有代码使用 `Mode.EXECUTE` 这样的常量引用
- 只有类型 `Mode` 被使用，常量对象未被使用

### 4.5 PlanStepStatus 常量对象

```typescript
export const PlanStepStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
```

**问题**：

- 代码中使用的是字符串字面量（如 `'pending'`、`'completed'`）
- 没有代码使用 `PlanStepStatus.PENDING` 这样的常量引用
- 只有类型 `PlanStepStatus` 被使用，常量对象未被使用

### 建议

**选项 1（推荐）**：保留这些类型定义

- 这些类型可能用于未来的功能扩展
- 作为共享类型包，提供完整的类型定义是有价值的
- 删除可能破坏外部依赖（如果有）

**选项 2**：删除未使用的类型

- 如果确定不需要，可以删除以简化代码
- 需要先搜索整个项目确认没有使用

**风险评估**：低风险。建议保留，因为这些是类型定义，不会影响运行时性能。

---

## 五、Python 代码中可能未使用的文件

### 5.1 prompts 子模块（低风险）

以下文件被 `prompts/__init__.py` 导入，但需要验证是否真正被使用：

- `prompts/identity.py` - 身份规则提示词
- `prompts/capabilities.py` - 能力说明提示词
- `prompts/tools.py` - 工具使用指南提示词
- `prompts/system.py` - 系统提示词组合函数

**分析**：

- 这些文件被 `prompts/__init__.py` 导入并导出
- `worker.py` 和 `runner.py` 导入了 `from prompts import compose_system_prompt` 和 `SYSTEM_PROMPT`
- 因此这些文件是**被使用的**，不是未使用文件

**结论**：保留这些文件。

### 5.2 skills/registry.py（低风险）

**文件**：`agents/src/skills/registry.py`

**分析**：

- 该文件被 `skills/__init__.py` 导入并导出
- `worker.py` 导入了 `from skills import get_skill_by_id`
- 因此该文件是**被使用的**，不是未使用文件

**结论**：保留该文件。

---

## 六、配置文件检查

### 6.1 环境变量文件（正常）

- `.env.example` - 被 Git 跟踪（正确）
- `apps/web/.env.example` - 被 Git 跟踪（正确）
- `.env` 和 `apps/web/.env` - 未被 Git 跟踪（正确，已在 `.gitignore` 中）

**结论**：环境变量文件配置正确。

### 6.2 Python 缓存目录（正常）

- `agents/.venv/` - 未被 Git 跟踪（正确）
- `agents/.pytest_cache/` - 未被 Git 跟踪（正确）
- `agents/.ruff_cache/` - 未被 Git 跟踪（正确）
- `agents/.mypy_cache/` - 未被 Git 跟踪（正确）

**结论**：Python 缓存目录配置正确。

---

## 七、总结与优先级

### 高优先级（建议立即修复）

1. **移除构建产物的 Git 跟踪** - 减少仓库体积，避免提交不必要的文件

### 中优先级（需要确认后修复）

2. **删除未使用的 useConversations Hook** - 需要确认功能是否在其他地方实现

### 低优先级（可选修复）

3. **删除 tailwind.config.js** - 需要验证 Tailwind v4 是否真的不需要此文件
4. **清理未使用的类型定义** - 建议保留，除非确定不需要

### 无需修复

5. **Python prompts 模块** - 经验证是被使用的
6. **Python skills/registry.py** - 经验证是被使用的
7. **环境变量文件配置** - 配置正确
8. **Python 缓存目录** - 配置正确

---

## 八、操作建议

### 立即可执行的操作

```bash
# 1. 更新 .gitignore
cat >> .gitignore << 'EOF'

# Build outputs
apps/web/dist/
apps/web/storybook-static/
apps/api-server/dist/
apps/api-server/docs/
packages/shared/dist/
packages/shared/docs/

# Turbo cache
**/.turbo/
EOF

# 2. 从 Git 中移除构建产物
git rm -r --cached apps/web/dist apps/web/storybook-static apps/api-server/dist apps/api-server/docs packages/shared/dist packages/shared/docs
git rm -r --cached apps/web/.turbo apps/api-server/.turbo packages/shared/.turbo

# 3. 提交更改
git add .gitignore
git commit -m "chore: remove build artifacts from git tracking and update .gitignore"
```

### 需要进一步确认的操作

1. **useConversations Hook**：
   - 检查 `apps/web/src/components/Sidebar.tsx` 是否有类似的会话管理逻辑
   - 如果有，删除 `apps/web/src/hooks/useConversations.ts`
   - 如果没有，保留文件或实现该功能

2. **tailwind.config.js**：
   - 备份文件：`mv apps/web/tailwind.config.js apps/web/tailwind.config.js.backup`
   - 运行 `pnpm dev` 检查样式是否正常
   - 如果正常，删除备份文件
   - 如果异常，恢复文件

---

## 九、附录：文件引用关系图

### 前端文件引用关系

```
main.tsx
  └─> App.tsx
       ├─> LoginPage.tsx
       ├─> ChatPage.tsx (lazy)
       │    ├─> useChat.ts
       │    ├─> useSlashCommands.ts
       │    ├─> MessageList.tsx
       │    │    └─> MessageBubble.tsx
       │    │         └─> PlanSection.tsx
       │    │              ├─> PlanTemplate.tsx
       │    │              └─> AgentCard.tsx
       │    └─> ChatInput.tsx
       │         ├─> SlashCommandPalette.tsx
       │         ├─> ModelSelector.tsx
       │         ├─> SkillsSelector.tsx
       │         └─> McpServersPanel.tsx
       └─> SettingsPage.tsx (lazy)

Sidebar.tsx (在 Layout.tsx 中使用)
  └─> 直接实现会话管理逻辑（未使用 useConversations）
```

### Python 文件引用关系

```
worker.py
  ├─> from prompts import compose_system_prompt
  ├─> from skills import get_skill_by_id
  └─> from memory import MemoryManager

runner.py
  ├─> from prompts import SYSTEM_PROMPT
  └─> from orchestrator import AgentOrchestrator

prompts/__init__.py
  ├─> from .identity import IDENTITY_RULES
  ├─> from .capabilities import CAPABILITIES
  ├─> from .tools import TOOL_GUIDE
  └─> from .system import compose_system_prompt, SYSTEM_PROMPT

skills/__init__.py
  └─> from .registry import Skill, BUILTIN_SKILLS, get_skill_by_id
```

---

**报告结束**
