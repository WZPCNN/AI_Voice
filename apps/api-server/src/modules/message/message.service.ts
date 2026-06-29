// MessageService — 消息查询服务,支持游标分页
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页查询会话消息,校验 session 归属 */
  async listBySession(userId: string, sessionId: string, cursor?: string, limit: number = 50) {
    // 先校验 session 归属
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) return [];

    return this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }
}
