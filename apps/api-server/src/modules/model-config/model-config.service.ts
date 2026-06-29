import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { encrypt, decrypt, maskApiKey } from '../../common/crypto';
import type { CreateModelConfigDto, UpdateModelConfigDto } from './dto/model-config.dto';

export type ModelConfigRow = Prisma.AgentConfigGetPayload<object>;

@Injectable()
export class ModelConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId: string): Promise<ModelConfigRow[]> {
    const rows = await this.prisma.agentConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.maskRow);
  }

  async getById(userId: string, id: string): Promise<ModelConfigRow | null> {
    const row = await this.prisma.agentConfig.findFirst({
      where: { id, userId },
    });
    return row ? this.maskRow(row) : null;
  }

  async create(userId: string, dto: CreateModelConfigDto): Promise<ModelConfigRow> {
    const row = await this.prisma.agentConfig.create({
      data: {
        userId,
        modelProvider: dto.modelProvider,
        modelName: dto.modelName,
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 4096,
        tools: dto.tools ?? [],
        systemPrompt: dto.systemPrompt ?? null,
        apiKey: dto.apiKey ? encrypt(dto.apiKey) : null,
        baseUrl: dto.baseUrl ?? null,
      },
    });
    return this.maskRow(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateModelConfigDto,
  ): Promise<ModelConfigRow | null> {
    try {
      const row = await this.prisma.agentConfig.update({
        where: { id, userId },
        data: {
          ...(dto.modelProvider !== undefined && { modelProvider: dto.modelProvider }),
          ...(dto.modelName !== undefined && { modelName: dto.modelName }),
          ...(dto.temperature !== undefined && { temperature: dto.temperature }),
          ...(dto.maxTokens !== undefined && { maxTokens: dto.maxTokens }),
          ...(dto.tools !== undefined && { tools: dto.tools }),
          ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt }),
          ...(dto.apiKey !== undefined && {
            apiKey: dto.apiKey ? encrypt(dto.apiKey) : null,
          }),
          ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        },
      });
      return this.maskRow(row);
    } catch {
      return null;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    try {
      await this.prisma.agentConfig.delete({ where: { id, userId } });
      return true;
    } catch {
      return false;
    }
  }

  async selectOne(userId: string, id: string): Promise<ModelConfigRow | null> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.agentConfig.updateMany({
          where: { userId },
          data: { isSelected: false },
        });
        return tx.agentConfig.update({
          where: { id, userId },
          data: { isSelected: true },
        });
      });
      return this.maskRow(row);
    } catch {
      return null;
    }
  }

  async getSelected(userId: string): Promise<ModelConfigRow | null> {
    const row = await this.prisma.agentConfig.findFirst({
      where: { userId, isSelected: true },
    });
    return row ? this.maskRow(row) : null;
  }

  /** 内部使用：返回解密后的真实 apiKey，供 chat.service 调用 */
  async getByIdForChat(userId: string, id: string): Promise<ModelConfigRow | null> {
    const row = await this.prisma.agentConfig.findFirst({
      where: { id, userId },
    });
    if (!row) return null;
    return { ...row, apiKey: row.apiKey ? decrypt(row.apiKey) : null };
  }

  /** 内部使用：返回解密后的选中配置，供 chat.service 调用 */
  async getSelectedForChat(userId: string): Promise<ModelConfigRow | null> {
    const row = await this.prisma.agentConfig.findFirst({
      where: { userId, isSelected: true },
    });
    if (!row) return null;
    return { ...row, apiKey: row.apiKey ? decrypt(row.apiKey) : null };
  }

  /** 脱敏 apiKey 用于对外返回（解密后脱敏，失败则返回 ****） */
  private maskRow = (row: ModelConfigRow): ModelConfigRow => {
    if (!row.apiKey) return row;
    try {
      return { ...row, apiKey: maskApiKey(decrypt(row.apiKey)) };
    } catch {
      return { ...row, apiKey: '****' };
    }
  };
}
