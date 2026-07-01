# AI Voice API Server

基于 NestJS 11 + Prisma 7 + Redis 构建的智能语音助手后端服务。

## 技术栈

- **框架**: NestJS 11.1.27
- **ORM**: Prisma 7.8.0
- **数据库**: PostgreSQL 19
- **缓存/消息队列**: Redis 8
- **向量数据库**: Qdrant
- **认证**: JWT + Passport
- **WebSocket**: Socket.io 4.8.3
- **验证**: class-validator + class-transformer

## 目录结构

```
src/
├── modules/           # 业务模块
│   ├── auth/          # 认证模块 (JWT, 登录, 注册)
│   ├── chat/          # 聊天核心模块 (消息处理, 流式响应)
│   ├── session/       # 会话管理模块
│   ├── model-config/  # 模型配置模块
│   ├── mcp/           # MCP 服务器管理模块
│   ├── skills/        # 技能管理模块
│   └── message/       # 消息存储模块
├── common/            # 公共工具
│   ├── guards/        # 认证守卫
│   ├── decorators/    # 自定义装饰器
│   ├── filters/       # 异常过滤器
│   └── interceptors/  # 拦截器
├── prisma/            # Prisma 服务
├── app.module.ts      # 根模块
└── main.ts            # 入口文件
```

## 开发命令

```bash
# 安装依赖 (在 monorepo 根目录)
pnpm install

# 生成 Prisma 客户端
pnpm prisma:generate

# 运行数据库迁移
pnpm prisma:migrate

# 打开 Prisma Studio (数据库可视化工具)
pnpm prisma:studio

# 启动开发服务器
pnpm dev
# 服务运行在 http://localhost:4000

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 运行测试
pnpm test

# 生成 API 文档 (TypeDoc)
pnpm docs:typedoc

# 生成架构图 (Compodoc)
pnpm docs:compodoc

# 生成所有文档
pnpm docs
```

## 环境变量

在 `apps/api-server/.env` 中配置:

```bash
# 数据库连接
DATABASE_URL="postgresql://user:password@localhost:5432/aivoicedb"

# Redis 连接
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant 连接
QDRANT_URL=http://localhost:6333

# JWT 密钥
JWT_SECRET=your-secret-key

# 服务端口
PORT=4000
```

## API 端点

### 认证

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/profile` - 获取当前用户信息

### 会话管理

- `GET /api/sessions` - 获取会话列表
- `POST /api/sessions` - 创建新会话
- `GET /api/sessions/:id` - 获取会话详情
- `DELETE /api/sessions/:id` - 删除会话

### 聊天

- `POST /api/chat` - 发送消息 (非流式)
- `POST /api/chat/stream` - 发送消息 (SSE 流式)
- `GET /api/chat/history/:sessionId` - 获取聊天历史

### 模型配置

- `GET /api/model-configs` - 获取模型配置列表
- `POST /api/model-configs` - 创建模型配置
- `PUT /api/model-configs/:id` - 更新模型配置
- `DELETE /api/model-configs/:id` - 删除模型配置

### MCP 服务器

- `GET /api/mcp/servers` - 获取 MCP 服务器列表
- `POST /api/mcp/servers` - 创建 MCP 服务器
- `PUT /api/mcp/servers/:id` - 更新 MCP 服务器
- `DELETE /api/mcp/servers/:id` - 删除 MCP 服务器

### 技能

- `GET /api/skills` - 获取技能列表

## 数据库模型

### User

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Session

```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String
  title     String
  mode      String   @default("exec")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  messages  Message[]
}
```

### Message

```prisma
model Message {
  id        String   @id @default(uuid())
  sessionId String
  role      String   # user, assistant, system
  content   String
  metadata  Json?
  createdAt DateTime @default(now())
  session   Session  @relation(fields: [sessionId], references: [id])
}
```

### ModelConfig

```prisma
model ModelConfig {
  id          String   @id @default(uuid())
  userId      String
  name        String
  provider    String   # openai, anthropic, ollama
  model       String
  apiKey      String
  baseUrl     String?
  temperature Float    @default(0.7)
  maxTokens   Int      @default(2000)
  isActive    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id])
}
```

### McpServer

```prisma
model McpServer {
  id        String   @id @default(uuid())
  userId    String
  name      String
  url       String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
}
```

## 架构说明

### 模块划分

- **AuthModule**: 处理用户认证,JWT token 生成和验证
- **ChatModule**: 核心聊天逻辑,处理消息流和 Agent 调用
- **SessionModule**: 管理用户会话,包括创建、查询、删除
- **ModelConfigModule**: 管理 LLM 模型配置
- **McpModule**: 管理 MCP 服务器配置
- **SkillsModule**: 提供技能列表查询
- **MessageModule**: 处理消息的持久化存储

### 数据流

1. 用户通过 WebSocket/HTTP 发送消息
2. ChatModule 接收消息,查询会话和模型配置
3. 调用 Python Agent 服务 (通过 HTTP)
4. Agent 处理消息,返回响应
5. 消息存储到数据库
6. 通过 WebSocket/HTTP 返回给用户

## 文档

- **TypeDoc API 文档**: 运行 `pnpm docs:typedoc`,输出到 `docs/typedoc/`
- **Compodoc 架构图**: 运行 `pnpm docs:compodoc`,输出到 `docs/compodoc/`

## 许可证

MIT
