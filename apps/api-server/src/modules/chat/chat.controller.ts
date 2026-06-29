import { Controller, Post, Body, Res, Req, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { SessionService } from '../session/session.service';
import { McpService } from '../mcp/mcp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const ENV_DEFAULTS = {
  provider: 'openai' as const,
  model: process.env.DEFAULT_MODEL ?? 'gpt-4o',
  temperature: parseFloat(process.env.DEFAULT_TEMPERATURE ?? '0.7'),
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || undefined,
  baseUrl: process.env.OPENAI_BASE_URL || process.env.ANTHROPIC_BASE_URL || undefined,
};

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly modelConfigService: ModelConfigService,
    private readonly sessionService: SessionService,
    private readonly mcpService: McpService,
  ) {}

  @Post('stream')
  async stream(
    @CurrentUser() user: { id: string },
    @Body()
    data: {
      sessionId: string;
      content: string;
      mode?: string;
      configId?: string;
      images?: string[];
      skill?: string;
    },
    @Req() req: { on: (event: string, cb: () => void) => void },
    @Res()
    res: {
      setHeader: (name: string, value: string) => void;
      flushHeaders: () => void;
      write: (chunk: string) => boolean;
      end: () => void;
      destroyed: boolean;
    },
  ) {
    const sessionId = data.sessionId;
    const mode = data.mode ?? 'execute';
    const userId = user.id;

    req.on('close', () => {
      this.chatService.cancelRequest(sessionId);
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let provider: string = ENV_DEFAULTS.provider;
    let model: string = ENV_DEFAULTS.model;
    let temperature: number = ENV_DEFAULTS.temperature;
    let apiKey: string | undefined;
    let baseUrl: string | undefined;

    let config = null;
    if (data.configId) {
      config = await this.modelConfigService.getByIdForChat(userId, data.configId);
    }
    if (!config) {
      config = await this.modelConfigService.getSelectedForChat(userId);
    }
    if (config) {
      provider = config.modelProvider;
      model = config.modelName;
      temperature = config.temperature;
      if (config.apiKey) apiKey = config.apiKey;
      if (config.baseUrl) baseUrl = config.baseUrl;
    }
    apiKey ??= ENV_DEFAULTS.apiKey;
    baseUrl ??= ENV_DEFAULTS.baseUrl;

    // 确保 session 存在且属于该用户,不存在则创建
    await this.sessionService.ensureOwned(userId, sessionId, data.content.slice(0, 30));
    // 异步保存用户消息(不阻塞流式响应)
    this.sessionService.saveMessage(sessionId, 'USER', data.content, {
      images: data.images ?? [],
    });

    // mcp 模式:获取用户活跃的 MCP 服务器配置
    const mcpServers = mode === 'mcp' ? await this.mcpService.getActiveForChat(userId) : [];

    // 累积 assistant 回复内容,用于流结束后持久化
    let assistantContent = '';
    try {
      for await (const chunk of this.chatService.processMessage(sessionId, data.content, mode, {
        provider,
        model,
        temperature,
        apiKey,
        baseUrl,
        images: data.images,
        skill: data.skill,
        mcpServers,
      })) {
        if (res.destroyed) break;
        // 累积 token 类型的回复内容
        if (chunk.type === 'token' && chunk.content) {
          assistantContent += chunk.content;
        }
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

    // 流结束后异步保存 assistant 消息
    if (assistantContent) {
      this.sessionService.saveMessage(sessionId, 'ASSISTANT', assistantContent).catch(() => {});
    }
  }
}
