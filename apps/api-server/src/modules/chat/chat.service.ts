import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import type { ChatChunk, StreamChunk } from '@agent-platform/shared';

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  private publisher!: RedisClientType;
  private readonly redisUrl: string;

  constructor(private readonly config: ConfigService) {
    this.redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  }

  async onModuleInit() {
    this.publisher = createClient({ url: this.redisUrl });
    await this.publisher.connect();
    this.logger.log('Redis publisher connected');
  }

  async onModuleDestroy() {
    await this.publisher?.disconnect();
  }

  async cancelRequest(sessionId: string) {
    try {
      await this.publisher.del('agent:response:list:' + sessionId);
      await this.publisher.publish('agent:cancel', sessionId);
    } catch {
      /* ignore */
    }
  }

  async *processMessage(
    sessionId: string,
    content: string,
    mode: string = 'execute',
    options?: {
      provider?: string;
      model?: string;
      temperature?: number;
      images?: string[];
      apiKey?: string;
      baseUrl?: string;
      skill?: string;
      mcpServers?: Array<{
        name: string;
        transport: string;
        command: string | null;
        url: string | null;
        env: Record<string, string> | null;
      }>;
    },
  ): AsyncGenerator<ChatChunk> {
    const listKey = 'agent:response:list:' + sessionId;
    // 每请求创建独立 reader 连接，避免并发 BLPOP 争抢单例连接
    const reader: RedisClientType = createClient({ url: this.redisUrl });
    await reader.connect();

    try {
      await this.publisher.del(listKey);
    } catch {
      /* ignore */
    }

    await this.publisher.lPush(
      'agent:request:list',
      JSON.stringify({
        session_id: sessionId,
        content,
        mode,
        provider: options?.provider ?? 'openai',
        model: options?.model ?? 'gpt-4o',
        temperature: options?.temperature ?? 0.7,
        images: options?.images ?? [],
        api_key: options?.apiKey ?? '',
        base_url: options?.baseUrl ?? '',
        history: [],
        skill: options?.skill ?? '',
        mcp_servers: options?.mcpServers ?? [],
      }),
    );

    const deadline = Date.now() + 120_000;

    try {
      while (true) {
        const result = await reader.blPop(listKey, 2);
        if (result === null || result === undefined) {
          if (Date.now() > deadline) {
            yield { type: 'error', message: '超时' };
            yield { type: 'done' };
            break;
          }
          continue;
        }
        const raw: string =
          typeof result === 'string' ? result : ((result as { element?: string }).element ?? '');
        try {
          const chunk: StreamChunk = JSON.parse(raw);
          yield chunk;
          if (chunk.type === 'error' || chunk.type === 'done') break;
        } catch (e) {
          this.logger.error('JSON parse failed: ' + e);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(message);
      yield { type: 'error', message };
      yield { type: 'done' };
    } finally {
      try {
        await reader.del(listKey);
      } catch {
        /* ignore */
      }
      await reader.disconnect();
    }
  }
}
