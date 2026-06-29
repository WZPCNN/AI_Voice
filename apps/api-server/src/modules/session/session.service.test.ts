// SessionService 单元测试 — 验证会话 CRUD、ensureOwned 与 saveMessage
import { SessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: {
    session: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    message: { create: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      session: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      message: { create: jest.fn() },
    };
    service = new SessionService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('应按 userId 查询并按 updatedAt 降序', async () => {
      const mock = [{ id: 's1' }];
      prisma.session.findMany.mockResolvedValue(mock);
      const result = await service.list('user-1');
      expect(result).toBe(mock);
      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('无 dto 时 title 默认 "New Session"', async () => {
      prisma.session.create.mockResolvedValue({ id: 's1' });
      await service.create('user-1');
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: 'New Session' },
      });
    });

    it('有 dto 时透传 title', async () => {
      prisma.session.create.mockResolvedValue({ id: 's2' });
      await service.create('user-1', { title: 'custom' });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: 'custom' },
      });
    });
  });

  describe('getById', () => {
    it('应按 id+userId 查询单个会话', async () => {
      prisma.session.findFirst.mockResolvedValue({ id: 's1' });
      const result = await service.getById('user-1', 's1');
      expect(result).toEqual({ id: 's1' });
      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', userId: 'user-1' },
      });
    });
  });

  describe('delete', () => {
    it('删除成功应返回 true', async () => {
      prisma.session.delete.mockResolvedValue({});
      const result = await service.delete('user-1', 's1');
      expect(result).toBe(true);
    });

    it('删除失败应返回 false', async () => {
      prisma.session.delete.mockRejectedValue(new Error('not found'));
      const result = await service.delete('user-1', 's1');
      expect(result).toBe(false);
    });
  });

  describe('ensureOwned', () => {
    it('会话已存在时不创建新会话', async () => {
      prisma.session.findFirst.mockResolvedValue({ id: 's1' });
      await service.ensureOwned('user-1', 's1', 'title hint');
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('会话不存在时应创建,标题用 titleHint', async () => {
      prisma.session.findFirst.mockResolvedValue(null);
      prisma.session.create.mockResolvedValue({ id: 's1' });
      await service.ensureOwned('user-1', 's1', 'hello world');
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { id: 's1', userId: 'user-1', title: 'hello world' },
      });
    });

    it('titleHint 为空时标题默认 "New Session"', async () => {
      prisma.session.findFirst.mockResolvedValue(null);
      await service.ensureOwned('user-1', 's1', '');
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { id: 's1', userId: 'user-1', title: 'New Session' },
      });
    });
  });

  describe('saveMessage', () => {
    it('应创建消息,metadata 默认空对象', async () => {
      prisma.message.create.mockResolvedValue({});
      await service.saveMessage('s1', 'USER', 'hello');
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { sessionId: 's1', role: 'USER', content: 'hello', metadata: {} },
      });
    });

    it('应透传 metadata', async () => {
      prisma.message.create.mockResolvedValue({});
      await service.saveMessage('s1', 'ASSISTANT', 'hi', { images: ['img1'] });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: 's1',
          role: 'ASSISTANT',
          content: 'hi',
          metadata: { images: ['img1'] },
        },
      });
    });
  });
});
