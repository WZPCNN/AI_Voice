// SkillsController — 内置技能列表端点
// 路由: GET /api/skills
// 返回硬编码的 3 个内置技能,与 Python 端 agents/src/skills/registry.py 对应
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  @Get()
  list() {
    return [
      {
        id: 'code-review',
        name: '代码审查',
        description: '审查代码质量、风格、潜在 bug',
        color: '#F59E0B',
      },
      {
        id: 'summarize',
        name: '文档摘要',
        description: '提取文档关键信息,生成结构化摘要',
        color: '#10B981',
      },
      {
        id: 'web-search',
        name: '网络搜索',
        description: '搜索网络信息,回答事实性问题',
        color: '#3B82F6',
      },
    ];
  }
}
