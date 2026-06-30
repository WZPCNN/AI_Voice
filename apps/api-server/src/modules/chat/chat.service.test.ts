jest.mock('redis');
import { createClient } from 'redis';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let publisher: {
    connect: jest.Mock;
    disconnect: jest.Mock;
    del: jest.Mock;
    publish: jest.Mock;
    lPush: jest.Mock;
  };
  let reader: {
    connect: jest.Mock;
    disconnect: jest.Mock;
    del: jest.Mock;
    blPop: jest.Mock;
  };
  let callCount: number;
  let config: { get: jest.Mock };

  beforeEach(() => {
    callCount = 0;
    publisher = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(0),
      publish: jest.fn().mockResolvedValue(0),
      lPush: jest.fn().mockResolvedValue(1),
    };
    reader = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(0),
      blPop: jest.fn(),
    };
    (createClient as unknown as jest.Mock).mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? publisher : reader;
    });
    config = { get: jest.fn().mockReturnValue('redis://test:6379') };
    service = new ChatService(config as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('生命周期', () => {
    it('onModuleInit 创建并连接 publisher', async () => {
      await service.onModuleInit();
      expect(createClient).toHaveBeenCalledWith({ url: 'redis://test:6379' });
      expect(publisher.connect).toHaveBeenCalledTimes(1);
    });

    it('onModuleDestroy 断开 publisher', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(publisher.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelRequest', () => {
    it('del response list + publish agent:cancel', async () => {
      await service.onModuleInit();
      await service.cancelRequest('sid');
      expect(publisher.del).toHaveBeenCalledWith('agent:response:list:sid');
      expect(publisher.publish).toHaveBeenCalledWith('agent:cancel', 'sid');
    });

    it('异常吞掉不抛且 publish 未调用', async () => {
      await service.onModuleInit();
      publisher.del.mockRejectedValue(new Error('fail'));
      await expect(service.cancelRequest('sid')).resolves.toBeUndefined();
      expect(publisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('processMessage 推送', () => {
    it('lPush 完整请求体含 session_id/content/mode/skill/mcp_servers', async () => {
      await service.onModuleInit();
      reader.blPop.mockResolvedValue({ element: JSON.stringify({ type: 'done' }) });
      const mcpServers = [
        { name: 'fs', transport: 'stdio', command: 'npx', url: null, env: { FOO: 'bar' } },
      ];
      const chunks: unknown[] = [];
      for await (const c of service.processMessage('sid', 'hi', 'mcp', {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.5,
        apiKey: 'k',
        baseUrl: 'b',
        images: ['i1'],
        skill: 'code-review',
        mcpServers,
      })) {
        chunks.push(c);
      }
      expect(publisher.lPush).toHaveBeenCalledWith('agent:request:list', expect.any(String));
      const body = JSON.parse(publisher.lPush.mock.calls[0][1]);
      expect(body).toMatchObject({
        session_id: 'sid',
        content: 'hi',
        mode: 'mcp',
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.5,
        api_key: 'k',
        base_url: 'b',
        images: ['i1'],
        skill: 'code-review',
        mcp_servers: mcpServers,
        history: [],
      });
    });
  });

  describe('processMessage 默认值', () => {
    it('options 缺省用 openai/gpt-4o/0.7/mcp_servers=[]', async () => {
      await service.onModuleInit();
      reader.blPop.mockResolvedValue({ element: JSON.stringify({ type: 'done' }) });
      const chunks: unknown[] = [];
      for await (const c of service.processMessage('sid', 'hi')) {
        chunks.push(c);
      }
      const body = JSON.parse(publisher.lPush.mock.calls[0][1]);
      expect(body.provider).toBe('openai');
      expect(body.model).toBe('gpt-4o');
      expect(body.temperature).toBe(0.7);
      expect(body.mcp_servers).toEqual([]);
      expect(body.skill).toBe('');
      expect(body.api_key).toBe('');
      expect(body.base_url).toBe('');
      expect(body.images).toEqual([]);
      expect(body.history).toEqual([]);
    });
  });

  describe('processMessage 流', () => {
    it('blPop 返回 token+done → yield 2 chunk', async () => {
      await service.onModuleInit();
      reader.blPop
        .mockResolvedValueOnce({ element: JSON.stringify({ type: 'token', content: 'hi' }) })
        .mockResolvedValueOnce({ element: JSON.stringify({ type: 'done' }) });
      const chunks: unknown[] = [];
      for await (const c of service.processMessage('sid', 'hi')) {
        chunks.push(c);
      }
      expect(chunks).toEqual([
        { type: 'token', content: 'hi' },
        { type: 'done' },
      ]);
    });

    it('error chunk 中断流(不再读后续 chunk)', async () => {
      await service.onModuleInit();
      reader.blPop
        .mockResolvedValueOnce({ element: JSON.stringify({ type: 'error', message: 'fail' }) })
        .mockResolvedValueOnce({ element: JSON.stringify({ type: 'done' }) });
      const chunks: unknown[] = [];
      for await (const c of service.processMessage('sid', 'hi')) {
        chunks.push(c);
      }
      expect(chunks).toEqual([{ type: 'error', message: 'fail' }]);
    });

    it('超时 yield error+done', async () => {
      await service.onModuleInit();
      reader.blPop.mockResolvedValue(null);
      const now = 1_000_000;
      const spy = jest.spyOn(Date, 'now');
      spy.mockReturnValueOnce(now);
      spy.mockReturnValueOnce(now);
      spy.mockReturnValueOnce(now + 130_000);
      const chunks: unknown[] = [];
      for await (const c of service.processMessage('sid', 'hi')) {
        chunks.push(c);
      }
      expect(chunks).toEqual([
        { type: 'error', message: '超时' },
        { type: 'done' },
      ]);
    });

    it('非 JSON → logger.error 继续,下个 done chunk 正常 yield', async () => {
      await service.onModuleInit();
      reader.blPop
        .mockResolvedValueOnce({ element: 'not-json' })
        .mockResolvedValueOnce({ element: JSON.stringify({ type: 'done' }) });
      const chunks: unknown[] = [];
      for await (const c of service.processMessage('sid', 'hi')) {
        chunks.push(c);
      }
      expect(chunks).toEqual([{ type: 'done' }]);
    });

    it('blPop 抛错 yield error+done,finally reader.disconnect', async () => {
      await service.onModuleInit();
      reader.blPop.mockRejectedValue(new Error('redis down'));
      const chunks: unknown[] = [];
      for await (const c of service.processMessage('sid', 'hi')) {
        chunks.push(c);
      }
      expect(chunks).toEqual([
        { type: 'error', message: 'redis down' },
        { type: 'done' },
      ]);
      expect(reader.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('独立 reader', () => {
    it('2 次 processMessage 后 createClient 共 3 次(publisher 1 + reader×2),每次 reader 请求结束 disconnect', async () => {
      await service.onModuleInit();
      expect(callCount).toBe(1);
      reader.blPop.mockResolvedValue({ element: JSON.stringify({ type: 'done' }) });

      const chunks1: unknown[] = [];
      for await (const c of service.processMessage('sid1', 'hi')) {
        chunks1.push(c);
      }
      expect(callCount).toBe(2);
      expect(reader.disconnect).toHaveBeenCalledTimes(1);

      const chunks2: unknown[] = [];
      for await (const c of service.processMessage('sid2', 'hi')) {
        chunks2.push(c);
      }
      expect(callCount).toBe(3);
      expect(reader.disconnect).toHaveBeenCalledTimes(2);
    });
  });
});
