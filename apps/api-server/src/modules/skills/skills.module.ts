// SkillsModule — 内置技能模块
// 仅提供技能列表端点,无数据库操作,无需 service 层
import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';

@Module({
  controllers: [SkillsController],
})
export class SkillsModule {}
