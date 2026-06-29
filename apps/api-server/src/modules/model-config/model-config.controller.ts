import { Controller, Get, Post, Put, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateModelConfigDto, UpdateModelConfigDto } from './dto/model-config.dto';

@Controller('model-configs')
@UseGuards(JwtAuthGuard)
export class ModelConfigController {
  constructor(private readonly service: ModelConfigService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.service.getAll(user.id);
  }

  @Get('selected')
  async getSelected(@CurrentUser() user: { id: string }) {
    return this.service.getSelected(user.id);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.getById(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateModelConfigDto) {
    return this.service.create(user.id, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateModelConfigDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.delete(user.id, id);
  }

  @Patch(':id/select')
  async select(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.selectOne(user.id, id);
  }
}
