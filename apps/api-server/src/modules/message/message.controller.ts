// MessageController — 消息查询路由,GET /api/sessions/:sessionId/messages
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly service: MessageService) {}

  @Get(':sessionId/messages')
  async list(
    @CurrentUser() user: { id: string },
    @Param('sessionId') sessionId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listBySession(
      user.id,
      sessionId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
