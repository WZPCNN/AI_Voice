// SessionController — 会话 CRUD 路由,全部需要 JWT 认证
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSessionDto, UpdateSessionDto } from './dto/session.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly service: SessionService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto?: CreateSessionDto) {
    return this.service.create(user.id, dto);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.getById(user.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const ok = await this.service.delete(user.id, id);
    return { success: ok };
  }
}
