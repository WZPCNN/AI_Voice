// SessionService — 会话 CRUD + 消息保存服务
// 提供会话的增删改查,以及聊天流程中用到的 ensureOwned 和 saveMessage
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateSessionDto, UpdateSessionDto } from './dto/session.dto';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** 列出当前用户的所有会话,按 updatedAt 降序 */
  async list(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** 创建新会话,title 默认 "New Session" */
  async create(userId: string, dto?: CreateSessionDto) {
    return this.prisma.session.create({
      data: {
        userId,
        title: dto?.title ?? 'New Session',
      },
    });
  }

  /** 获取单个会话(校验归属) */
  async getById(userId: string, id: string) {
    return this.prisma.session.findFirst({
      where: { id, userId },
    });
  }

  /** 更新会话标题 */
  async update(userId: string, id: string, dto: UpdateSessionDto) {
    return this.prisma.session.update({
      where: { id, userId },
      data: { title: dto.title },
    });
  }

  /** 删除会话,成功返回 true,不存在或无权限返回 false */
  async delete(userId: string, id: string): Promise<boolean> {
    try {
      await this.prisma.session.delete({ where: { id, userId } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 确保会话存在且属于该用户,不存在则创建。
   * 用于聊天流程:前端可能传入尚未持久化的临时 sessionId。
   *
   * @param userId 用户 ID
   * @param sessionId 会话 ID(前端生成的 UUID)
   * @param titleHint 会话标题提示(通常取用户消息前 30 字)
   */
  async ensureOwned(userId: string, sessionId: string, titleHint: string): Promise<void> {
    const existing = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.session.create({
        data: {
          id: sessionId,
          userId,
          title: titleHint || 'New Session',
        },
      });
    }
  }

  /**
   * 保存一条消息到指定会话。
   * 用于聊天流程中持久化 USER 和 ASSISTANT 消息。
   *
   * @param sessionId 会话 ID
   * @param role 消息角色:USER / ASSISTANT / TOOL / AGENT
   * @param content 消息文本内容
   * @param metadata 附加元数据(如图片列表)
   */
  async saveMessage(
    sessionId: string,
    role: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.message.create({
      data: {
        sessionId,
        role,
        content,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JSON 字段类型(InputJsonValue)与 Record 不完全兼容
        metadata: (metadata ?? {}) as any,
      },
    });
  }
}
