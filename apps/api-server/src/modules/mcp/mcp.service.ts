// McpService — MCP 服务器配置 CRUD + 查询活跃配置(供 ChatService 使用)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateMcpServerDto, UpdateMcpServerDto } from './dto/mcp-server.dto';

@Injectable()
export class McpService {
  constructor(private readonly prisma: PrismaService) {}

  /** 列出当前用户的所有 MCP 服务器 */
  async getAll(userId: string) {
    return this.prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 创建 MCP 服务器 */
  async create(userId: string, dto: CreateMcpServerDto) {
    return this.prisma.mcpServer.create({
      data: {
        userId,
        name: dto.name,
        transport: dto.transport,
        command: dto.command ?? null,
        url: dto.url ?? null,
        env: dto.env ?? undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /** 更新 MCP 服务器 */
  async update(userId: string, id: string, dto: UpdateMcpServerDto) {
    try {
      return await this.prisma.mcpServer.update({
        where: { id, userId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.transport !== undefined && { transport: dto.transport }),
          ...(dto.command !== undefined && { command: dto.command }),
          ...(dto.url !== undefined && { url: dto.url }),
          ...(dto.env !== undefined && { env: dto.env }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch {
      return null;
    }
  }

  /** 删除 MCP 服务器 */
  async delete(userId: string, id: string): Promise<boolean> {
    try {
      await this.prisma.mcpServer.delete({ where: { id, userId } });
      return true;
    } catch {
      return false;
    }
  }

  /** 获取用户活跃的 MCP 服务器配置(供 ChatService 在 mcp 模式下使用) */
  async getActiveForChat(userId: string) {
    const servers = await this.prisma.mcpServer.findMany({
      where: { userId, isActive: true },
    });
    // 返回精简字段,仅包含 Python worker 需要的信息
    return servers.map((s) => ({
      name: s.name,
      transport: s.transport,
      command: s.command,
      url: s.url,
      env: s.env as Record<string, string> | null,
    }));
  }
}
