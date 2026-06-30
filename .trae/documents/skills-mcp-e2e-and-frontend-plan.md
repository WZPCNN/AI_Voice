# skills/mcp 端到端联调 + 测试补全 + 前端优化 计划

## Context(背景)

项目刚从中文路径 `D:\MyProject\智能体开发` 迁移到 ASCII 路径 `d:\MyProject\AIVoice`(解决 TypeScript Language Server URI 编码 bug)。迁移过程中确认:后端 `chat.controller.ts` 和 `chat.service.ts` 已完整支持 skills/mcp 模式(注入 McpService、mode==='mcp' 拉配置、推送 skill/mcp_servers 给 Redis),Python worker 也实现了 5 种模式分支。

但存在三类遗留问题:
1. **测试缺口**:chat 层零测试,agents 缺 worker 模式分支测试,无法保障回归。
2. **端到端未验证**:skills/mcp 模式从未真正跑通,且 `packages/shared/src/schema.sql` 是旧版(无 mcp_servers 表、sessions.mode CHECK 只允许 plan/execute),会导致插入 mcp 会话失败。
3. **前端体验粗糙**:无设计 token(20+ 颜色硬编码)、无 UI 组件库、无动画库,与 React 19 + Tailwind v4 的现代栈不匹配。

本计划目标:补测试 → 修 schema 跑通联调 → 前端全面优化(含 shadcn 迁移)。

## 用户决策(已确认)

- 前端范围:**全部 A+B(含 shadcn 迁移)**
- 联调凭据:**只提供 OpenAI key**(mcp 模式工具数 0,退化对话;skills 模式完整)
- DB 重置:**可以清空**(`docker compose down -v` 重建)

---

## 阶段 0:前置准备(用户配合,不写代码)

用户需生成并提供:
1. `JWT_SECRET`:≥32 字符,`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
2. `ENCRYPTION_KEY`:64 位 hex,`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`(`crypto.ts` 模块加载时强制要求此格式)
3. `OPENAI_API_KEY`:真实 key(用于阶段 4 联调,当前 .env 是占位符)

> 密钥值由用户提供,阶段 1 负责写入 `.env`。

---

## 阶段 1:修复 schema.sql + 重建 DB

**目标**:让 docker-compose 产出的数据库与 Prisma schema 完全一致,可写入 skills/multi/mcp 模式会话与 mcp_servers 记录。

**关键文件**:
- `d:\MyProject\AIVoice\packages\shared\src\schema.sql`(改)
- `d:\MyProject\AIVoice\apps\api-server\.env`(补密钥)
- `d:\MyProject\AIVoice\apps\api-server\prisma\schema.prisma`(只读对齐基准)

**当前不一致点(已核实)**:
- [schema.sql:6-13](file:///d:\MyProject\AIVoice\packages\shared\src\schema.sql#L6-L13) `users` 缺 `password`、`role` 列(Prisma [schema.prisma:30-31](file:///d:\MyProject\AIVoice\apps\api-server\prisma\schema.prisma#L30-L31) 有)
- [schema.sql:20](file:///d:\MyProject\AIVoice\packages\shared\src\schema.sql#L20) `sessions.mode` 有 `CHECK (mode IN ('plan', 'execute'))`,会拒绝 multi/skills/mcp(Prisma [schema.prisma:47](file:///d:\MyProject\AIVoice\apps\api-server\prisma\schema.prisma#L47) 是 String 无约束)
- 缺 `mcp_servers` 表(Prisma [schema.prisma:92-107](file:///d:\MyProject\AIVoice\apps\api-server\prisma\schema.prisma#L92-L107) 有)

**步骤**:
1. 编辑 `schema.sql`:
   - `users` 表加 `password VARCHAR(255)`、`role VARCHAR(20) NOT NULL DEFAULT 'user'`
   - `sessions.mode` 的 CHECK **删除**(完全对齐 Prisma,Prisma 端无 CHECK)
   - 末尾追加 `mcp_servers` 表(字段对齐 Prisma:id/userId/name/transport/command/url/env(jsonb)/isActive/createdAt/updatedAt + `CREATE INDEX idx_mcp_servers_user ON mcp_servers(user_id)`)
2. 在 `apps/api-server/.env` 追加用户提供的 `JWT_SECRET` 与 `ENCRYPTION_KEY`
3. 重建 DB:`docker compose -f docker/docker-compose.yml down -v` → `docker compose -f docker/docker-compose.yml up -d`
4. 生成 Prisma Client:`pnpm --filter @ai-voice/api-server exec prisma generate`
5. 校验同步:`pnpm --filter @ai-voice/api-server exec prisma db push`(应无 diff 或微小 diff)

**验证**:
- `docker exec agent-platform-db psql -U agent -d agent_platform -c "\dt"` 见 `mcp_servers` 表
- `docker exec agent-platform-db psql -U agent -d agent_platform -c "INSERT INTO sessions (id,user_id,mode) VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','mcp')"` 成功
- `docker exec agent-platform-db psql -U agent -d agent_platform -c "\d users"` 见 password/role 列

**风险**:`down -v` 清空本地 dev 数据(用户已同意)。回退:`git revert` schema.sql + `down -v` + 旧文件 `up -d`。

---

## 阶段 2:chat 层 Jest 单测(可并行,无依赖)

**目标**:补 `chat.controller.test.ts` 与 `chat.service.test.ts`,覆盖零测试的 chat 层。

**关键文件**:
- 新增 `apps/api-server/src/modules/chat/chat.controller.test.ts`
- 新增 `apps/api-server/src/modules/chat/chat.service.test.ts`
- 参考 `apps/api-server/src/modules/mcp/mcp.service.test.ts`(手写 mock 范式)
- 配置:`apps/api-server/jest.config.js`(已配 ts-jest + @ai-voice/shared 映射)

**Mock 策略**(沿用 mcp.service.test.ts,不用 createTestingModule):
- controller:`new ChatController(chatService, modelConfigService, sessionService, mcpService)`,四个依赖手写 `jest.fn()` 对象,直接调用 `controller.stream(user, data, req, res)`
- service:`jest.mock('redis')`,`new ChatService(config)`,createClient mock 按调用次序区分 publisher(第1次,onModuleInit)/reader(第2次,processMessage)

**chat.controller.test.ts 用例**:
| 分组 | 用例 |
|------|------|
| SSE 头 | 设置 Content-Type/Cache-Control/Connection + flushHeaders |
| mode 默认 | 不传 mode 默认 'execute',不触发 mcpService.getActiveForChat |
| mcp 触发 | mode='mcp' 调 getActiveForChat 并透传 mcpServers |
| 非 mcp | mode='skills'/'plan' 时 mcpServers 传空数组 |
| config 解析 | configId 命中走 getByIdForChat;未命中回退 getSelectedForChat;都无用 ENV_DEFAULTS;apiKey 空回退 ENV |
| session 持久化 | ensureOwned 收到 content.slice(0,30);saveMessage('USER', content, {images}) |
| 流式输出 | processMessage yield token → SSE write;res.destroyed 中断;抛错写 error+done;流后异步 saveMessage('ASSISTANT') |
| 关闭取消 | req.on('close') 注册,触发后 cancelRequest |
| 字段透传 | images/skill 传入 processMessage options |

**chat.service.test.ts 用例**:
| 分组 | 用例 |
|------|------|
| 生命周期 | onModuleInit 创建连接 publisher;onModuleDestroy 断开 |
| cancelRequest | publisher.del(list key) + publish('agent:cancel', sid);异常吞掉 |
| processMessage 推送 | lPush 完整请求体(含 session_id/content/mode/skill/mcp_servers 等) |
| processMessage 默认值 | options 缺省用 openai/gpt-4o/0.7/mcp_servers=[] |
| processMessage 流 | blPop 返回 token+done → yield;error chunk 中断;超时(jest.spyOn Date.now) yield 超时+done;非 JSON → logger.error 继续;blPop 抛错 → yield error+done,finally disconnect |
| 独立 reader | createClient 共调用 2 次,reader 在请求结束 disconnect |

**验证**:`pnpm --filter @ai-voice/api-server test` 新增 2 文件全绿,现有 4 测试不回归。

**风险**:低(纯单测)。回退:删除测试文件。

---

## 阶段 3:agents worker_modes pytest(可并行,无依赖)

**目标**:补 `tests/test_worker_modes.py`,覆盖 `worker.py` 5 种模式分支 + 错误/取消路径。

**关键文件**:
- 新增 `agents/tests/test_worker_modes.py`
- 参考 `agents/tests/test_skills.py`(import 风格)、`agents/src/worker.py`(被测)
- 配置:`agents/pyproject.toml`(asyncio_mode=auto, pythonpath=["src"])

**Mock 策略**:
- import:用 `from worker import AgentWorker`(匹配 worker.py 自身风格);若失败退回 `from src.worker`
- 实例化:`AgentWorker.__new__(AgentWorker)` 绕过 `__init__`(避免 LangchainOllamaEmbeddingProvider/QdrantVectorStore 重型构造),手动设 `_first_chunk_printed=False`、`_running_tasks={}`、`memory=FakeMemory()`、`_publisher=FakePublisher()`
- patch `worker.AgentRunner`、`worker.PlanExecutor`、`worker.MultiAgentOrchestrator`(别名 DeepAgentOrchestrator)、`worker.McpClientManager`、`worker.get_skill_by_id`
- FakeMemory:`add_turn`(同步)、`build_context`(async 返回 "")、`finish_turn`(async no-op)
- FakePublisher:`rpush`(async 记录)、`expire`(async no-op)
- runner mock:`run` 为 async generator,产出 `json.dumps({"type":"token","content":"..."})+"\n"` 与 `json.dumps({"type":"done"})+"\n"`

**用例**:
| 用例 | 模式 | 断言 |
|------|------|------|
| test_exec_mode | exec | AgentRunner 无 tool_names/tools;runner.run 调用;rpush 收 token+done;memory.add_turn('user'/'assistant') |
| test_plan_mode | plan | PlanExecutor(runner).execute 调用 |
| test_multi_mode | multi | DeepAgentOrchestrator(runner).execute 调用 |
| test_skills_found | skills | get_skill_by_id 返回 skill;_make_runner 收 tool_names;run 收 system_prompt |
| test_skills_not_found | skills | get_skill_by_id 返回 None;回退 exec;warning skill_not_found |
| test_mcp_success | mcp | McpClientManager 实例化;connect_all + discover_tools 返回 [tool];AgentRunner 收 tools;run 收 _MCP_SYSTEM_PROMPT;流后 close |
| test_mcp_connect_fail | mcp | connect_all 抛异常;except 内 close;异常上抛 → rpush error+done |
| test_exception | 任意 | runner.run 抛 Exception → rpush error+done |
| test_cancelled | 任意 | runner.run 抛 CancelledError → rpush 仅 done(非 error) |
| test_token_accumulation | exec | 多 token 拼接写入 memory.add_turn('assistant', full) |

**验证**:`cd agents && uv run pytest tests/test_worker_modes.py -v` 全绿;`uv run pytest` 全套不回归。

**风险**:低。回退:删除测试文件。

---

## 阶段 4:端到端联调(依赖阶段 1 + OpenAI key)

**目标**:验证 web → api-server → Redis → worker → LLM 全链路在 skills/mcp 模式下打通。

**关键文件**(只读验证):
- `apps/api-server/src/modules/chat/chat.controller.ts`、`chat.service.ts`
- `agents/src/worker.py`
- `apps/web/vite.config.ts`(确认 /api 代理到 4000)

**步骤**(README 三终端法,worker 单独起):
1. 基础设施:`docker compose -f docker/docker-compose.yml up -d`(阶段 1 已做)
2. 终端 1 - Worker:`cd agents`;`$env:OPENAI_API_KEY="sk-真实key"`;`$env:PYTHONPATH="src"; .venv\Scripts\python.exe -m worker`。确认日志 `worker_starting` / `polling_redis_list`
3. 终端 2 - API Server:`cd apps/api-server && pnpm dev`(默认 4000)。确认启动无 ENCRYPTION_KEY 报错
4. 终端 3 - Web:`cd apps/web && pnpm dev`(默认 3000)
5. 终端 4(可选)- Redis 监控:`docker exec -it agent-platform-redis redis-cli MONITOR`

**联调流程**:
1. 注册用户:`POST http://localhost:4000/api/auth/register` `{email,password,name}` → 登录拿 token
2. 建模型配置:`POST /api/model-config` 带真实 OpenAI apiKey → `POST /api/model-config/:id/select` 选中
3. skills 模式(完整验证):`POST /api/chat/stream` body `{sessionId:<uuid>,content:"审查这段代码:...",mode:"skills",skill:"code-review"}`
4. mcp 模式(工具数 0 退化):`POST /api/chat/stream` body `{sessionId:<uuid>,content:"列出 /tmp 文件",mode:"mcp"}` —— 用户无 MCP 服务器配置,worker 连 0 个服务器,退化无工具对话

**验证方法**:
- Redis MONITOR:见 `LPUSH agent:request:list ...` 与 `BRPOP agent:response:list:<sid>`
- Worker structlog:skills 模式见 `starting_skills_mode skill=code-review`;mcp 模式见 `starting_mcp_mode tools_count=0`
- SSE 响应:收到 `data: {"type":"token","content":"..."}` 流,末尾 `data: {"type":"done"}`
- DB:会话 mode='skills'/'mcp' 落库成功,USER 与 ASSISTANT 消息落 messages 表

**用户配合点**:OpenAI key(用户已确认提供)。

**风险**:
- OPENAI_API_KEY 占位符致 401 → 用户换真 key
- mcp 模式工具数 0 → 退化对话(用户已知情,无 MCP 服务器配置)
- 无 e2e CI,本阶段为手动验证

---

## 阶段 5:前端样式与动画优化(全部 A+B,含 shadcn)

**目标**:建立设计 token + 工具链 + 动画库 + shadcn 渐进迁移,全面提升视觉与动效。

**依赖**:无(与后端阶段解耦,可任意时机并行)。

**React 19 兼容性已核实**:motion(v11.11+,新包名 `motion`,import 自 `motion/react`)、clsx、tailwind-merge、cva、tw-animate-css、shadcn/ui(基于 Radix)均兼容 React 19.2.7 + Tailwind v4。

### A1. @theme 设计 token

**文件**:`apps/web/src/index.css`(改)

**做法**:在 `@import "tailwindcss";` 后加 `@theme` 块定义语义化颜色:
```css
@theme {
  --color-primary: #6366F1;
  --color-primary-hover: #4f46e5;
  --color-ink: #1A1A2E;
  --color-surface: #F5F6FA;
  --color-surface-2: #F8F9FC;
  --color-border: #EBECF0;
  --color-border-soft: #E8E8EC;
  --color-danger: #EF4444;
  --color-danger-bg: #FEF2F2;
  --color-danger-border: #FECACA;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-info: #3B82F6;
  --color-muted: #999;
  --color-sub: #666;
}
```
Tailwind v4 据此生成 `bg-primary`/`text-ink`/`border-border` 等工具类。

**渐进替换**(代表性文件):
- `apps/web/src/chat/MessageBubble.tsx`:`bg-[#6366F1]` → `bg-primary`、`#6366F140` → `bg-primary/25`
- `apps/web/src/chat/SlashCommandPalette.tsx`、`MessageList.tsx`、`ModelSelector.tsx`、`pages/SettingsPage.tsx`、`pages/ChatPage.tsx`、`components/Sidebar.tsx`:同模式替换硬编码 hex
- `index.css` 的 `.markdown-body` 内 `#6366f1`/`#4f46e5`/`#1A1A2E` 等改用 var(--color-primary) 等

**验证**:`pnpm --filter @ai-voice/web build` 通过,视觉无变化(纯映射)。

### A2. clsx + tailwind-merge + cva

**文件**:
- `apps/web/package.json`(加依赖:`clsx`、`tailwind-merge`、`class-variance-authority`)
- 新增 `apps/web/src/lib/cn.ts`
- 改 `MessageBubble.tsx`、`SlashCommandPalette.tsx`、`MessageList.tsx`、`Sidebar.tsx`(className 拼接改 `cn(...)`)

**做法**:
```ts
// apps/web/src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
条件类名:`cn(isUser ? 'bg-primary' : 'bg-surface', 'rounded-2xl')`。可用 cva 定义按钮/徽章变体。

**验证**:`pnpm --filter @ai-voice/web build && typecheck` 通过,视觉无变化。

### A3. motion/react 动画

**文件**:
- `apps/web/package.json`(加依赖:`motion`)
- `apps/web/src/chat/MessageBubble.tsx`(进场动画)
- `apps/web/src/chat/SlashCommandPalette.tsx`(AnimatePresence + scale)
- `apps/web/src/chat/MessageList.tsx`(错误条 AnimatePresence)
- `apps/web/src/App.tsx`(路由 AnimatePresence 过渡,可选)

**做法**:
- `MessageBubble`:外层 `<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.2}}>`
- `SlashCommandPalette`:`<AnimatePresence>` 包裹,`<motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}} transition={{duration:0.15}}>`(当前 `cmds.length===0 return null` 改为由父组件控制 mount 以支持 exit)
- `MessageList` 错误条:`<AnimatePresence>{sendError && <motion.div ...exit.../>}</AnimatePresence>`
- 路由:`App.tsx` 用 `AnimatePresence mode="wait"` 包 `<Routes>`,location key 触发淡入淡出

**验证**:`pnpm --filter @ai-voice/web build` 通过;手动看气泡淡入、面板缩放、错误条滑入、路由切换过渡。

**风险**:motion 包体积约 30-50kb gz(可 tree-shake);长列表进场动画可能影响性能(仅首帧 initial)。回退:移除 motion 依赖与包裹。

### B4. tw-animate-css(可选,与 motion 互补)

**文件**:`apps/web/src/index.css`(`@import "tw-animate-css";`)、`apps/web/package.json`(加依赖)

**价值**:轻量 CSS 动画工具集(animate-in/fade-in/slide-in-from-bottom),适合 hover/focus 微交互。与 motion 功能重叠,简单场景用 CSS、复杂用 motion。

**风险**:低。若 A3 motion 已覆盖大部分需求,此步可跳过。

### B5. 逐字流式动画

**文件**:`apps/web/src/chat/MessageBubble.tsx`(流式内容渲染)

**做法**:对 streaming 中新增 token 套 `<motion.span initial={{opacity:0}} animate={{opacity:1}}>` 或 CSS `@keyframes token-in`。难点:需区分"已稳定 token"与"新 token"避免每帧重渲染全量;可对最后 N 个 token 做动画。

**风险**:中(性能 + 实现复杂度)。回退:保留现有 `streaming-cursor` 脉冲。

### B6. shadcn/ui 渐进迁移

**依赖**:shadcn CLI(`npx shadcn@latest init`),基于 Radix UI,React 19 兼容。

**做法**:按需引入组件,替换手写组件:
- `SlashCommandPalette` → shadcn `Command`(自带键盘导航 + 动画 + 无障碍)
- `ModelSelector` → shadcn `Popover` + `Command` 或 `Select`
- 错误条 → shadcn `Alert`
- `Sidebar` 抽屉(移动端)→ shadcn `Sheet` 或 `vaul`(Drawer,React 19 兼容)
- 按钮 → shadcn `Button`(用 cva 定义 variants,与 A2 结合)

**配置**:
- `apps/web/components.json`(shadcn 配置,指定 Tailwind v4、别名路径)
- 复用 A1 的 @theme token 作为 shadcn CSS 变量(--primary、--background 等),保持风格统一
- `apps/web/src/components/ui/`(shadcn 生成目录)

**迁移策略**:渐进式,一次替换一个组件,每次 `build && typecheck` 验证。不强制全量替换,优先替换 SlashCommandPalette 和 ModelSelector(手写最复杂、收益最大)。

**验证**:每替换一个组件,`pnpm --filter @ai-voice/web build && typecheck && lint` 通过,手动验证交互(键盘导航、焦点陷阱、动画)。

**风险**:中高(组件 API 变化,需调整调用方)。回退:git revert 对应组件。注意 shadcn 组件直接生成在 `components/ui/`,可保留备用不强制使用。

---

## 全量验证(所有阶段完成后)

```bash
# 后端
pnpm --filter @ai-voice/api-server typecheck
pnpm --filter @ai-voice/api-server lint
pnpm --filter @ai-voice/api-server test
pnpm --filter @ai-voice/api-server build

# 前端
pnpm --filter @ai-voice/web typecheck
pnpm --filter @ai-voice/web lint
pnpm --filter @ai-voice/web build

# Python
cd agents && uv run pytest

# 根级
pnpm typecheck
pnpm lint
pnpm spellcheck
pnpm build
```

---

## 风险总表

| 风险 | 等级 | 阶段 | 缓解/回退 |
|------|------|------|-----------|
| `docker compose down -v` 清空本地 dev 数据 | 高 | 1 | 用户已同意;回退 git revert + 旧 schema |
| `prisma db push` 提示重置 | 中 | 1 | 按提示确认或 down -v 重来 |
| OPENAI_API_KEY 占位符致 401 | 中 | 4 | 用户换真 key |
| mcp 模式工具数 0 | 低 | 4 | 用户已知情,退化对话可接受 |
| motion 包体积 + 列表性能 | 中 | 5-A3 | tree-shake;仅首帧 initial;回退移除 motion |
| 逐字流式动画性能 | 中 | 5-B5 | 仅末尾 token 动画;回退保留 streaming-cursor |
| shadcn 组件 API 变化 | 中高 | 5-B6 | 渐进式一次一组件;每次 build 验证;git revert 回退 |
| worker import 风格不一致 | 低 | 3 | 优先 `from worker`;失败退回 `from src.worker` |

---

## 执行顺序与并行策略

```
阶段 0  用户准备密钥 ─────────────────────────┐
阶段 1  schema.sql + DB 重建(依赖 0)─────────┤
                                              │
阶段 2  chat 层 Jest(可并行)─────────────────┤
阶段 3  worker_modes pytest(可并行)──────────┤
阶段 5  前端优化(可并行,独立)─────────────────┘
                                              │
阶段 4  端到端联调(依赖 1 + OpenAI key)──────┘
```

- 阶段 2、3、5 互相独立,失败不影响其他阶段
- 阶段 4 是唯一强依赖阶段 1 + 用户 key 的环节
- 建议执行顺序:1 → (2 ∥ 3 ∥ 5) → 4 → 全量验证
