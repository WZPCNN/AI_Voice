# AI Voice Shared

共享 TypeScript 类型定义包,为前端和后端提供统一的类型系统。

## 技术栈

- **语言**: TypeScript 6.0.3
- **构建**: 无构建过程,直接导出源码
- **用途**: 跨包类型共享

## 目录结构

```
src/
├── index.ts           # 主入口,导出所有类型
└── types/
    └── index.ts       # 核心类型定义
```

## 导出的类型

### AppMode

应用工作模式枚举:

```typescript
type AppMode = 'multi' | 'plan' | 'exec' | 'skills' | 'mcp';
```

- `exec` - 直接执行模式,快速响应
- `plan` - 计划模式,先制定计划再执行
- `multi` - 多 Agent 协作模式
- `skills` - 技能模式,使用预定义技能
- `mcp` - MCP 模式,调用外部工具

### Message

聊天消息类型:

```typescript
interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
```

### PlanStep

计划步骤类型:

```typescript
interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignee?: string;
  result?: string;
}
```

### ChatChunk

流式聊天数据块:

```typescript
interface ChatChunk {
  type: 'token' | 'plan' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  plan?: PlanStep[];
  toolCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  toolResult?: {
    name: string;
    output: string;
  };
  error?: string;
}
```

### SkillInfo

技能信息类型:

```typescript
interface SkillInfo {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tools: string[];
}
```

### McpServerConfig

MCP 服务器配置类型:

```typescript
interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}
```

### ModelConfig

模型配置类型:

```typescript
interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}
```

## 使用方式

在其他包中引用:

```typescript
import { AppMode, Message, PlanStep } from '@ai-voice/shared';
```

由于采用源码直接导出,无需构建步骤。TypeScript 会自动解析类型定义。

## 开发命令

```bash
# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 生成 API 文档 (TypeDoc)
pnpm docs:typedoc
```

## 添加新类型

1. 在 `src/types/index.ts` 中定义新类型
2. 在 `src/index.ts` 中导出
3. 其他包即可直接引用

## 许可证

MIT
