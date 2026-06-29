// 从 @nestjs/common 导入 Module 装饰器,用于声明 NestJS 模块
import { Module } from '@nestjs/common';
// 从 @nestjs/config 导入 ConfigModule,用于加载 .env 环境变量并提供 ConfigService
import { ConfigModule } from '@nestjs/config';
// 导入 Joi 校验 schema,用于启动时校验环境变量合法性
import { configValidationSchema } from './common/validation.schema';
// 导入 AuthModule — 认证模块,提供注册/登录/JWT 守卫
import { AuthModule } from './modules/auth/auth.module';
// 导入 ChatModule — 聊天模块,提供 SSE 流式聊天接口
import { ChatModule } from './modules/chat/chat.module';
// 导入 PrismaModule — Prisma ORM 模块,封装数据库连接(全局模块)
import { PrismaModule } from './prisma/prisma.module';
// 导入 ModelConfigModule — 模型配置模块,管理 LLM 模型配置(Provider、API Key 等)
import { ModelConfigModule } from './modules/model-config/model-config.module';
import { SessionModule } from './modules/session/session.module';
import { MessageModule } from './modules/message/message.module';
import { McpModule } from './modules/mcp/mcp.module';
import { SkillsModule } from './modules/skills/skills.module';

// @Module 装饰器:声明应用根模块
// imports 数组列出所有需要加载的子模块
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    PrismaModule,
    AuthModule,
    ChatModule,
    ModelConfigModule,
    SessionModule,
    MessageModule,
    McpModule,
    SkillsModule,
  ],
})
// 导出 AppModule 类,供 main.ts 中 NestFactory.create 使用
export class AppModule {}
