// McpController — MCP 服务器配置 HTTP 控制器
// 路由: GET/POST /api/mcp-servers, PATCH/DELETE /api/mcp-servers/:id
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { McpService } from './mcp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateMcpServerDto, UpdateMcpServerDto } from './dto/mcp-server.dto';

@Controller('mcp-servers')
@UseGuards(JwtAuthGuard)
export class McpController {
  constructor(private readonly service: McpService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.service.getAll(user.id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateMcpServerDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const ok = await this.service.delete(user.id, id);
    return { success: ok };
  }
}
