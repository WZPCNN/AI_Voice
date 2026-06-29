// McpService 单元测试 — 验证 MCP 服务器配置 CRUD 与 getActiveForChat
import { McpService } from './mcp.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('McpService', () => {
  let service: McpService;
  let prisma: {
    mcpServer: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      mcpServer: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new McpService(prisma as unknown as PrismaService);
  });

  describe('getAll', () => {
    it('应按 userId 查询并按 createdAt 降序', async () => {
      const mock = [{ id: '1', name: 'fs' }];
      prisma.mcpServer.findMany.mockResolvedValue(mock);
      const result = await service.getAll('user-1');
      expect(result).toBe(mock);
      expect(prisma.mcpServer.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('应创建服务器,command/url 默认 null,isActive 默认 true', async () => {
      const dto = { name: 'test', transport: 'stdio' as const };
      prisma.mcpServer.create.mockResolvedValue({ id: '1', ...dto });
      await service.create('user-1', dto);
      expect(prisma.mcpServer.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'test',
          transport: 'stdio',
          command: null,
          url: null,
          env: undefined,
          isActive: true,
        },
      });
    });

    it('应透传 command/url/env/isActive', async () => {
      const dto = {
        name: 'sse-server',
        transport: 'sse' as const,
        url: 'http://localhost:3001',
        isActive: false,
      };
      prisma.mcpServer.create.mockResolvedValue({ id: '2' });
      await service.create('user-1', dto);
      expect(prisma.mcpServer.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'sse-server',
          transport: 'sse',
          command: null,
          url: 'http://localhost:3001',
          env: undefined,
          isActive: false,
        },
      });
    });
  });

  describe('update', () => {
    it('应仅更新提供的字段', async () => {
      prisma.mcpServer.update.mockResolvedValue({ id: '1' });
      await service.update('user-1', '1', { name: 'renamed' });
      expect(prisma.mcpServer.update).toHaveBeenCalledWith({
        where: { id: '1', userId: 'user-1' },
        data: { name: 'renamed' },
      });
    });

    it('更新失败应返回 null(catch)', async () => {
      prisma.mcpServer.update.mockRejectedValue(new Error('not found'));
      const result = await service.update('user-1', '1', { name: 'x' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('删除成功应返回 true', async () => {
      prisma.mcpServer.delete.mockResolvedValue({});
      const result = await service.delete('user-1', '1');
      expect(result).toBe(true);
    });

    it('删除失败应返回 false', async () => {
      prisma.mcpServer.delete.mockRejectedValue(new Error('not found'));
      const result = await service.delete('user-1', '1');
      expect(result).toBe(false);
    });
  });

  describe('getActiveForChat', () => {
    it('应返回活跃服务器的精简字段', async () => {
      prisma.mcpServer.findMany.mockResolvedValue([
        {
          name: 'fs',
          transport: 'stdio',
          command: 'npx',
          url: null,
          env: { FOO: 'bar' },
        },
      ]);
      const result = await service.getActiveForChat('user-1');
      expect(prisma.mcpServer.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
      });
      expect(result).toEqual([
        {
          name: 'fs',
          transport: 'stdio',
          command: 'npx',
          url: null,
          env: { FOO: 'bar' },
        },
      ]);
    });

    it('无活跃服务器应返回空数组', async () => {
      prisma.mcpServer.findMany.mockResolvedValue([]);
      const result = await service.getActiveForChat('user-1');
      expect(result).toEqual([]);
    });
  });
});
