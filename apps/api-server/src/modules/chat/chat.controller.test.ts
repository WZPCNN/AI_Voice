import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { SessionService } from '../session/session.service';
import { McpService } from '../mcp/mcp.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: { processMessage: jest.Mock; cancelRequest: jest.Mock };
  let modelConfigService: { getByIdForChat: jest.Mock; getSelectedForChat: jest.Mock };
  let sessionService: { ensureOwned: jest.Mock; saveMessage: jest.Mock };
  let mcpService: { getActiveForChat: jest.Mock };

  const makeGen = (chunks: Array<Record<string, unknown>>) =>
    (async function* () {
      for (const c of chunks) yield c;
    })();

  const makeReq = () => ({ on: jest.fn() });
  const makeRes = () => ({
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
    destroyed: false,
  });

  beforeEach(() => {
    chatService = {
      processMessage: jest.fn().mockReturnValue(makeGen([])),
      cancelRequest: jest.fn(),
    };
    modelConfigService = {
      getByIdForChat: jest.fn().mockResolvedValue(null),
      getSelectedForChat: jest.fn().mockResolvedValue(null),
    };
    sessionService = {
      ensureOwned: jest.fn().mockResolvedValue(undefined),
      saveMessage: jest.fn().mockResolvedValue(undefined),
    };
    mcpService = {
      getActiveForChat: jest.fn().mockResolvedValue([]),
    };
    controller = new ChatController(
      chatService as unknown as ChatService,
      modelConfigService as unknown as ModelConfigService,
      sessionService as unknown as SessionService,
      mcpService as unknown as McpService,
    );
  });

  describe('SSE 头', () => {
    it('应设置 Content-Type/Cache-Control/Connection 并 flushHeaders', async () => {
      const req = makeReq();
      const res = makeRes();
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        req as never,
        res as never,
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.flushHeaders).toHaveBeenCalledTimes(1);
    });
  });

  describe('mode 默认', () => {
    it('不传 mode 默认 execute,不触发 mcpService', async () => {
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        makeRes() as never,
      );
      expect(chatService.processMessage).toHaveBeenCalledWith('s1', 'hi', 'execute', expect.anything());
      expect(mcpService.getActiveForChat).not.toHaveBeenCalled();
    });

    it('mode=skills 不触发 mcpService 且 mcpServers 为空数组', async () => {
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi', mode: 'skills' },
        makeReq() as never,
        makeRes() as never,
      );
      expect(mcpService.getActiveForChat).not.toHaveBeenCalled();
      const opts = chatService.processMessage.mock.calls[0][3];
      expect(opts.mcpServers).toEqual([]);
    });

    it('mode=plan 不触发 mcpService', async () => {
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi', mode: 'plan' },
        makeReq() as never,
        makeRes() as never,
      );
      expect(mcpService.getActiveForChat).not.toHaveBeenCalled();
    });
  });

  describe('mcp 触发', () => {
    it('mode=mcp 调用 getActiveForChat 并透传 mcpServers 到 processMessage', async () => {
      const mockServers = [
        { name: 'fs', transport: 'stdio', command: 'npx', url: null, env: { FOO: 'bar' } },
      ];
      mcpService.getActiveForChat.mockResolvedValue(mockServers);
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi', mode: 'mcp' },
        makeReq() as never,
        makeRes() as never,
      );
      expect(mcpService.getActiveForChat).toHaveBeenCalledWith('u1');
      const opts = chatService.processMessage.mock.calls[0][3];
      expect(opts.mcpServers).toBe(mockServers);
    });
  });

  describe('config 解析', () => {
    it('configId 命中走 getByIdForChat,不调 getSelectedForChat', async () => {
      const cfg = {
        modelProvider: 'anthropic',
        modelName: 'claude',
        temperature: 0.5,
        apiKey: 'k',
        baseUrl: 'b',
      };
      modelConfigService.getByIdForChat.mockResolvedValue(cfg);
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi', configId: 'c1' },
        makeReq() as never,
        makeRes() as never,
      );
      expect(modelConfigService.getByIdForChat).toHaveBeenCalledWith('u1', 'c1');
      expect(modelConfigService.getSelectedForChat).not.toHaveBeenCalled();
      const opts = chatService.processMessage.mock.calls[0][3];
      expect(opts.provider).toBe('anthropic');
      expect(opts.model).toBe('claude');
      expect(opts.temperature).toBe(0.5);
      expect(opts.apiKey).toBe('k');
      expect(opts.baseUrl).toBe('b');
    });

    it('configId 未命中回退 getSelectedForChat', async () => {
      const cfg = {
        modelProvider: 'openai',
        modelName: 'gpt-4',
        temperature: 0.7,
        apiKey: 'k2',
        baseUrl: null,
      };
      modelConfigService.getByIdForChat.mockResolvedValue(null);
      modelConfigService.getSelectedForChat.mockResolvedValue(cfg);
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi', configId: 'c1' },
        makeReq() as never,
        makeRes() as never,
      );
      expect(modelConfigService.getByIdForChat).toHaveBeenCalledWith('u1', 'c1');
      expect(modelConfigService.getSelectedForChat).toHaveBeenCalledWith('u1');
    });

    it('都无配置用 ENV_DEFAULTS', async () => {
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        makeRes() as never,
      );
      const opts = chatService.processMessage.mock.calls[0][3];
      expect(opts.provider).toBe('openai');
      expect(opts.model).toBe(process.env.DEFAULT_MODEL ?? 'gpt-4o');
      expect(opts.temperature).toBe(parseFloat(process.env.DEFAULT_TEMPERATURE ?? '0.7'));
    });

    it('config.apiKey 为空时回退 ENV_DEFAULTS.apiKey', async () => {
      const cfg = {
        modelProvider: 'openai',
        modelName: 'gpt-4',
        temperature: 0.7,
        apiKey: null,
        baseUrl: null,
      };
      modelConfigService.getSelectedForChat.mockResolvedValue(cfg);
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        makeRes() as never,
      );
      const opts = chatService.processMessage.mock.calls[0][3];
      const expectedApiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || undefined;
      expect(opts.apiKey).toBe(expectedApiKey);
    });
  });

  describe('session 持久化', () => {
    it('ensureOwned 收到 content.slice(0,30) 作为 title', async () => {
      const longContent = 'a'.repeat(50);
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: longContent },
        makeReq() as never,
        makeRes() as never,
      );
      expect(sessionService.ensureOwned).toHaveBeenCalledWith('u1', 's1', 'a'.repeat(30));
    });

    it('saveMessage 保存 USER 消息含 images', async () => {
      const images = ['img1', 'img2'];
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi', images },
        makeReq() as never,
        makeRes() as never,
      );
      expect(sessionService.saveMessage).toHaveBeenCalledWith('s1', 'USER', 'hi', { images });
    });

    it('流后异步 saveMessage ASSISTANT 累积内容', async () => {
      chatService.processMessage.mockReturnValue(
        makeGen([
          { type: 'token', content: 'Hello' },
          { type: 'token', content: ' world' },
        ]),
      );
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        makeRes() as never,
      );
      await new Promise((r) => setImmediate(r));
      expect(sessionService.saveMessage).toHaveBeenCalledWith('s1', 'ASSISTANT', 'Hello world');
    });
  });

  describe('流式输出', () => {
    it('token chunk 写入 SSE', async () => {
      const chunk = { type: 'token', content: 'hi' };
      chatService.processMessage.mockReturnValue(makeGen([chunk]));
      const res = makeRes();
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        res as never,
      );
      expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    it('正常结束写 done 并 end', async () => {
      const res = makeRes();
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        res as never,
      );
      expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('res.destroyed 中断循环,仅写首个 token', async () => {
      const gen = (async function* () {
        yield { type: 'token', content: 'a' };
        yield { type: 'token', content: 'b' };
      })();
      chatService.processMessage.mockReturnValue(gen);
      const res = makeRes();
      res.write.mockImplementation(() => {
        res.destroyed = true;
        return true;
      });
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        res as never,
      );
      const tokenWrites = res.write.mock.calls.filter((c) => c[0].includes('"type":"token"'));
      expect(tokenWrites).toHaveLength(1);
    });

    it('processMessage 抛错写 error+done 并 end', async () => {
      // eslint-disable-next-line require-yield
      const errGen = (async function* () {
        throw new Error('boom');
      })();
      chatService.processMessage.mockReturnValue(errGen);
      const res = makeRes();
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        makeReq() as never,
        res as never,
      );
      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ type: 'error', message: 'boom' })}\n\n`,
      );
      expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      expect(res.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('关闭取消', () => {
    it('req.on close 注册回调,触发后调 cancelRequest', async () => {
      const req = makeReq();
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi' },
        req as never,
        makeRes() as never,
      );
      expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));
      const cb = req.on.mock.calls.find((c) => c[0] === 'close')[1] as () => void;
      cb();
      expect(chatService.cancelRequest).toHaveBeenCalledWith('s1');
    });
  });

  describe('字段透传', () => {
    it('images/skill 透传 processMessage options', async () => {
      await controller.stream(
        { id: 'u1' },
        { sessionId: 's1', content: 'hi', images: ['i1'], skill: 'code-review' },
        makeReq() as never,
        makeRes() as never,
      );
      const opts = chatService.processMessage.mock.calls[0][3];
      expect(opts.images).toEqual(['i1']);
      expect(opts.skill).toBe('code-review');
    });
  });
});
