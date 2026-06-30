# skills/mcp 任务续作 — chat 层 Jest 单测计划

## Summary(摘要)

用户请求"接着把今早被打断的 skills/mcp 模式任务重新启动,更新 chat.controller.ts 和 chat.service.ts"。经 Phase 1 探索核实:**这两个文件已完整支持 skills/mcp 模式,无需任何更新**。真正被打断的任务是已被批准的总体计划 [`skills-mcp-e2e-and-frontend-plan.md`](file:///d:\MyProject\AIVoice\.trae\documents\skills-mcp-e2e-and-frontend-plan.md) 的执行——Phase 1(schema 修复 + DB 重建)已完成,下一步是 Phase 2(chat 层 Jest 单测)。

本计划聚焦 Phase 2 的落地,并简要指向 Phase 3/4/5 的后续执行。

---

## Current State Analysis(现状分析)

### chat.controller.ts 和 chat.service.ts 已支持 skills/mcp(已验证,无需更新)

**[chat.controller.ts:5](file:///d:\MyProject\AIVoice\apps\api-server\src\modules\chat\chat.controller.ts#L5)** 注入 `McpService`
**[chat.controller.ts:93](file:///d:\MyProject\AIVoice\apps\api-server\src\modules\chat\chat.controller.ts#L93)** `mode === 'mcp'` 时调 `mcpService.getActiveForChat(userId)`
**[chat.controller.ts:98-107](file:///d:\MyProject\AIVoice\apps\api-server\src\modules\chat\chat.controller.ts#L98-L107)** `processMessage` 透传 `skill: data.skill, mcpServers`
**[chat.service.ts:47-53](file:///d:\MyProject\AIVoice\apps\api-server\src\modules\chat\chat.service.ts#L47-L53)** `mcpServers` 类型定义
**[chat.service.ts:80-81](file:///d:\MyProject\AIVoice\apps\api-server\src\modules\chat\chat.service.ts#L80-L81)** 推送 `skill` 与 `mcp_servers` 到 Redis 请求体

### Phase 1 已完成(DB 状态已核实)

- ✅ `docker ps` 三容器 healthy(db/redis/qdrant)
- ✅ `mcp_servers` 表存在,10 列(id/user_id/name/transport/command/url/env/is_active/created_at/updated_at)
- ✅ `sessions.mode` 是 `VARCHAR(50)` 无 CHECK 约束(可写入 skills/multi/mcp)
- ✅ `users` 表含 `password VARCHAR(255)` 与 `role VARCHAR(20) DEFAULT 'user'`
- ✅ 5 张表齐全:users / sessions / messages / agent_configs / mcp_servers

### 测试缺口(本计划目标)

- `apps/api-server/src/modules/chat/` 目录下**仅 3 个文件**(controller/service/module),**零测试**
- `agents/tests/` 下**无 test_worker_modes.py**(只有 test_skills/test_models/test_tools)

### 现有测试基建(可直接复用)

- [jest.config.js](file:///d:\MyProject\AIVoice\apps\api-server\jest.config.js):ts-jest preset、`testMatch: ['**/*.test.ts']`、`moduleNameMapper` 映射 `@ai-voice/shared` 到源码、内联 tsconfig(strict + experimentalDecorators + emitDecoratorMetadata)
- [jest.setup.ts](file:///d:\MyProject\AIVoice\apps\api-server\jest.setup.ts):预设 `ENCRYPTION_KEY`(64 字符 a)、`JWT_SECRET`、`JWT_EXPIRES_IN`、`NODE_ENV=test`
- [mcp.service.test.ts](file:///d:\MyProject\AIVoice\apps\api-server\src\modules\mcp\mcp.service.test.ts):mock 范式参考——**不用 `createTestingModule`**、`new Service(mockDeps)`、手写 `jest.fn()`、`beforeEach` 重建 mocks

---

## Proposed Changes(变更方案)

### 立即执行:Phase 2 — chat 层 Jest 单测

#### 文件 1:新增 `apps/api-server/src/modules/chat/chat.controller.test.ts`

**Mock 策略**(沿用 mcp.service.test.ts 范式,手写 4 个依赖):

```ts
const chatService = {
  processMessage: jest.fn(),  // 返回 async generator
  cancelRequest: jest.fn(),
};
const modelConfigService = {
  getByIdForChat: jest.fn(),
  getSelectedForChat: jest.fn(),
};
const sessionService = {
  ensureOwned: jest.fn().mockResolvedValue(undefined),
  saveMessage: jest.fn().mockResolvedValue(undefined),
};
const mcpService = {
  getActiveForChat: jest.fn().mockResolvedValue([]),
};
const controller = new ChatController(chatService, modelConfigService, sessionService, mcpService);
```

**req/res mock**:

```ts
const req = { on: jest.fn() };
const res = {
  setHeader: jest.fn(),
  flushHeaders: jest.fn(),
  write: jest.fn(),
  end: jest.fn(),
  destroyed: false,
};
```

**processMessage async generator 工厂**:

```ts
async function* genFrom(chunks: any[]) {
  for (const c of chunks) yield c;
}
chatService.processMessage.mockReturnValue(genFrom([...]));
```

**用例矩阵(18 个)**:

| 分组 | 用例 | 断言要点 |
|------|------|----------|
| SSE 头 | 应设置 Content-Type/Cache-Control/Connection 并 flushHeaders | res.setHeader 调用 3 次,flushHeaders 调用 1 次 |
| mode 默认 | 不传 mode 默认 execute,不触发 mcpService | processMessage 收到 mode='execute';mcpService.getActiveForChat 未调用 |
| mode=skills | 不触发 mcpService | mcpService.getActiveForChat 未调用;mcpServers=[] |
| mode=plan | 不触发 mcpService | 同上 |
| mcp 触发 | mode=mcp 调用 getActiveForChat 并透传 mcpServers | mcpService.getActiveForChat('user-1') 调用;processMessage options.mcpServers === mock 返回值 |
| config 解析 | configId 命中走 getByIdForChat | getByIdForChat(user, id) 调用;getSelectedForChat 未调用 |
| config 回退 | configId 未命中回退 getSelectedForChat | getByIdForChat 返回 null;getSelectedForChat 调用 |
| ENV 默认 | 都无配置用 ENV_DEFAULTS | provider=openai,model=gpt-4o,temperature=0.7;apiKey 取 ENV |
| apiKey 回退 | config.apiKey 为空时回退 ENV_DEFAULTS.apiKey | config 返回 apiKey=undefined;最终 apiKey=ENV_DEFAULTS.apiKey |
| session 持久化 | ensureOwned 收到 content.slice(0,30) | sessionService.ensureOwned(userId, sid, content 前 30 字符) |
| USER 消息 | saveMessage 保存 USER 消息含 images | saveMessage(sid, 'USER', content, {images}) |
| ASSISTANT 消息 | 流后异步 saveMessage ASSISTANT | processMessage yield token 累积;saveMessage(sid,'ASSISTANT',累积内容) 调用 |
| token 流 | token chunk 写入 SSE | res.write 收到 `data: {"type":"token","content":"hi"}\n\n` |
| done 写入 | 正常结束写 done | res.write 收到 `data: {"type":"done"}\n\n`;res.end 调用 |
| destroyed 中断 | res.destroyed 中断循环 | 设 destroyed=true;processMessage generator 提前 break |
| 抛错 | processMessage 抛错写 error+done | res.write 收到 error chunk;res.end 仍调用 |
| 关闭取消 | req.on close 注册 cancelRequest | req.on('close', cb) 调用;触发 cb → chatService.cancelRequest(sid) |
| 字段透传 | images/skill 透传 processMessage | processMessage options.images/skill === data 传入值 |

#### 文件 2:新增 `apps/api-server/src/modules/chat/chat.service.test.ts`

**Mock 策略**:

```ts
jest.mock('redis');
import { createClient } from 'redis';

// 按调用次序区分 publisher(第1次,onModuleInit)/reader(第2次,processMessage)
let callCount = 0;
const publisher = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(0),
  publish: jest.fn().mockResolvedValue(0),
  lPush: jest.fn().mockResolvedValue(1),
};
const reader = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(0),
  blPop: jest.fn(),
};
(createClient as jest.Mock).mockImplementation(() => {
  callCount++;
  return callCount === 1 ? publisher : reader;
});

const config = { get: jest.fn().mockReturnValue('redis://test:6379') };
const service = new ChatService(config);
```

**用例矩阵(11 个)**:

| 分组 | 用例 | 断言要点 |
|------|------|----------|
| 生命周期 | onModuleInit 创建并连接 publisher | createClient 第1次返回 publisher;publisher.connect 调用 |
| 生命周期 | onModuleDestroy 断开 publisher | publisher.disconnect 调用 |
| cancelRequest | del response list + publish agent:cancel | publisher.del('agent:response:list:sid') + publisher.publish('agent:cancel','sid') |
| cancelRequest | 异常吞掉不抛 | publisher.del 抛错;调用不抛 |
| processMessage 推送 | lPush 完整请求体含 session_id/content/mode/skill/mcp_servers | publisher.lPush('agent:request:list', JSON.stringify({...}));JSON.parse 验证字段 |
| processMessage 默认值 | options 缺省用 openai/gpt-4o/0.7/mcp_servers=[] | lPush body 含 provider='openai',model='gpt-4o',temperature=0.7,mcp_servers=[] |
| processMessage 流 | blPop 返回 token+done → yield | reader.blPop 返回 token 字符串后返回 done;generator yield 2 chunk |
| error 中断 | error chunk 中断流 | blPop 返回 error chunk;yield 后 break |
| 超时 | 超时 yield error+done | jest.spyOn(Date,'now') 控制;blPop 返回 null;deadline 后 yield 超时 |
| 异常 | blPop 抛错 yield error+done,finally disconnect | reader.blPop reject;yield error;finally reader.disconnect 调用 |
| 独立 reader | createClient 共 2 次,reader 请求结束 disconnect | 2 次 processMessage 后 callCount=3(publisher 1 + reader×2);每次 reader.disconnect 调用 |

#### 验证步骤

```bash
# 运行新增测试(应全绿)
pnpm --filter @ai-voice/api-server test

# 现有 4 个测试不回归
# (mcp.service.test.ts、auth.controller.test.ts、auth.service.test.ts、model-config.service.test.ts 等已存在的)
```

### 后续阶段(本计划不实现,指向总体计划)

| 阶段 | 内容 | 参考计划章节 |
|------|------|-------------|
| Phase 3 | agents worker_modes pytest(5 模式分支 + 错误/取消路径) | [总体计划 阶段 3](file:///d:\MyProject\AIVoice\.trae\documents\skills-mcp-e2e-and-frontend-plan.md) |
| Phase 4 | 端到端联调(需 OpenAI key) | [总体计划 阶段 4](file:///d:\MyProject\AIVoice\.trae\documents\skills-mcp-e2e-and-frontend-plan.md) |
| Phase 5 | 前端优化(A1-A3 + B4-B6,含 shadcn) | [总体计划 阶段 5](file:///d:\MyProject\AIVoice\.trae\documents\skills-mcp-e2e-and-frontend-plan.md) |

---

## Assumptions & Decisions(假设与决策)

### 假设
1. **chat.controller.ts 和 chat.service.ts 无需更新**——已验证完整支持 skills/mcp 模式(注入 McpService、mode 分支、字段透传)
2. **Phase 1 已完成**——DB schema 已修复并验证(mcp_servers 表、sessions.mode 无 CHECK、users 含 password/role)
3. **mock 范式沿用 mcp.service.test.ts**——不用 `createTestingModule`,手写 `jest.fn()` 对象,`new Service(mockDeps)` 直接实例化
4. **redis mock 用 `jest.mock('redis')`**——`createClient` 按 callCount 区分 publisher/reader

### 决策
1. **本计划仅实现 Phase 2**——chat 层 Jest 单测,因为这是"被打断任务"的直接延续
2. **不重复总体计划**——Phase 3/4/5 引用现有 [`skills-mcp-e2e-and-frontend-plan.md`](file:///d:\MyProject\AIVoice\.trae\documents\skills-mcp-e2e-and-frontend-plan.md)
3. **测试用例数**:controller 18 个、service 11 个,覆盖所有分支(SSE 头/mode 分支/config 解析/session 持久化/流式输出/取消/字段透传/生命周期/cancel/推送/默认值/超时/异常)
4. **不写注释**——遵循 AGENTS.md 默认无注释原则(测试用例描述用 `it('应...')` 自然语言表达意图)

### 风险
| 风险 | 等级 | 缓解 |
|------|------|------|
| redis mock createClient 调用次序错乱 | 低 | beforeEach 重置 callCount=0 |
| async generator mock 写法不熟 | 低 | 参考 `async function* genFrom(chunks)` 工厂 |
| Date.now spy 影响其他测试 | 低 | afterEach restore |
| controller stream 方法无返回值,断言靠 mock 调用 | 低 | 全部用 jest.fn() mock 断言 |

---

## Verification Steps(验证步骤)

1. **新增测试全绿**:
   ```bash
   pnpm --filter @ai-voice/api-server test
   ```
   预期:chat.controller.test.ts(18 用例)+ chat.service.test.ts(11 用例)全绿

2. **现有测试不回归**:
   - mcp.service.test.ts(9 用例)
   - auth 相关测试
   - model-config 相关测试
   - 全部仍绿

3. **lint/typecheck 不回归**:
   ```bash
   pnpm --filter @ai-voice/api-server typecheck
   pnpm --filter @ai-voice/api-server lint
   ```

4. **测试覆盖率**(可选):
   ```bash
   pnpm --filter @ai-voice/api-server test --coverage
   ```
   预期:chat.controller.ts 和 chat.service.ts 覆盖率 ≥80%(AGENTS.md 目标)

---

## 执行顺序

1. 创建 `chat.controller.test.ts`(18 用例)
2. 创建 `chat.service.test.ts`(11 用例)
3. 运行 `pnpm --filter @ai-voice/api-server test` 验证全绿
4. 运行 typecheck + lint 验证无回归
5. 报告结果,询问是否继续 Phase 3/5(Phase 4 需 OpenAI key)
