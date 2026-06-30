# AI Voice Web 前端

基于 React 19 + TypeScript + Vite + Tailwind CSS 4 构建的智能语音助手前端应用。

## 技术栈

- **框架**: React 19.2.7
- **构建工具**: Vite 8.1.0
- **样式**: Tailwind CSS 4.3.1
- **状态管理**: Zustand 5.0.14
- **路由**: React Router 7.18.0
- **Markdown 渲染**: react-markdown 10.1.0
- **图标**: lucide-react 1.22.0
- **富文本编辑**: TipTap 3.27.1

## 目录结构

```
src/
├── chat/              # 聊天相关组件
│   ├── MessageBubble.tsx      # 消息气泡组件
│   ├── SlashCommandPalette.tsx # 斜杠命令面板
│   ├── ModelSelector.tsx      # 模型选择器
│   ├── PlanSection.tsx        # 计划执行区域
│   ├── SkillsSelector.tsx     # 技能选择器
│   ├── McpServersPanel.tsx    # MCP 服务器面板
│   ├── ChatInput.tsx          # 聊天输入框
│   ├── MessageList.tsx        # 消息列表
│   ├── AgentCard.tsx          # Agent 卡片
│   └── PlanTemplate.tsx       # 计划模板
├── components/        # 通用组件
│   ├── Sidebar.tsx            # 侧边栏
│   ├── AuthGuard.tsx          # 认证守卫
│   └── Layout.tsx             # 布局组件
├── store/             # Zustand 状态管理
├── lib/               # 工具函数和 API 客户端
├── hooks/             # 自定义 Hooks
├── App.tsx            # 根组件
└── main.tsx           # 入口文件
```

## 开发命令

```bash
# 安装依赖 (在 monorepo 根目录)
pnpm install

# 启动开发服务器
pnpm dev
# 访问 http://localhost:3000

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 启动 Storybook (组件文档)
pnpm storybook
# 访问 http://localhost:6006

# 构建 Storybook 静态文件
pnpm build-storybook
```

## 核心功能

### 5 种工作模式

1. **Execute 模式** - 直接执行任务,快速响应
2. **Plan 模式** - 先制定计划,再逐步执行
3. **Multi 模式** - 多 Agent 协作,复杂任务分解
4. **Skills 模式** - 使用预定义技能处理特定任务
5. **MCP 模式** - 通过 Model Context Protocol 调用外部工具

### 斜杠命令

在聊天输入框中输入 `/` 触发命令面板:
- `/mode exec` - 切换到执行模式
- `/mode plan` - 切换到计划模式
- `/mode multi` - 切换到多 Agent 模式
- `/mode skills` - 切换到技能模式
- `/mode mcp` - 切换到 MCP 模式

### 模型选择

通过 `ModelSelector` 组件切换不同的 LLM 模型配置,支持:
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude Sonnet 4, Claude 3.5 Haiku)
- Ollama (本地模型)

### 会话管理

- 左侧边栏显示历史会话列表
- 支持新建、删除、搜索会话
- 会话标题自动从首条消息生成

## API 代理

开发环境下,Vite 会将 `/api` 请求代理到后端服务器:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:4000'
  }
}
```

## 组件文档

Storybook 提供了交互式组件文档,包含:
- MessageBubble - 消息气泡的各种状态
- SlashCommandPalette - 斜杠命令面板
- ModelSelector - 模型选择器
- Sidebar - 侧边栏

运行 `pnpm storybook` 查看完整文档。

## 环境变量

前端不需要环境变量,所有配置通过 API 从后端获取。

## 构建输出

生产构建输出到 `dist/` 目录,包含:
- 优化后的 JavaScript 和 CSS 文件
- 静态资源 (图片、字体等)
- index.html 入口文件

## 依赖说明

- `@ai-voice/shared` - 共享类型定义 (workspace 包)
- `@ai-voice/eslint-config` - 共享 ESLint 配置 (workspace 包)

## 许可证

MIT
