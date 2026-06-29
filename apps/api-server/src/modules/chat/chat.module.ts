// 从 @nestjs/common 导入 Module 装饰器,用于声明 NestJS 模块
import { Module } from '@nestjs/common';
// 导入 ChatController — 聊天模块的 HTTP 控制器,处理 /chat/* 路由
import { ChatController } from './chat.controller';
// 导入 ChatService — 聊天业务服务,负责与 Redis 队列交互、转发消息给 Python Worker
import { ChatService } from './chat.service';
// 导入 ModelConfigModule — 模型配置模块,ChatController 需要它来读取用户选择的 LLM 配置
import { ModelConfigModule } from '../model-config/model-config.module';
import { SessionModule } from '../session/session.module';
import { McpModule } from '../mcp/mcp.module';

/**
 * ChatModule — 聊天功能模块
 * 整合聊天控制器、服务以及对模型配置模块的依赖
 */
@Module({
  // imports:本模块依赖的其他模块
  // ModelConfigModule — 提供 ModelConfigService,用于查询用户配置的 LLM 模型参数
  // SessionModule — 提供 SessionService,用于保存对话消息到数据库
  // McpModule — 提供 McpService,用于 mcp 模式下读取用户活跃的 MCP 服务器配置
  imports: [ModelConfigModule, SessionModule, McpModule],
  // controllers:注册本模块的 HTTP 控制器
  // ChatController 处理 POST /chat/stream 接口,提供 SSE 流式聊天能力
  controllers: [ChatController],
  // providers:注册本模块的本地服务
  // ChatService 作为单例,在 ChatController 中通过构造函数注入
  providers: [ChatService],
})
// 导出 ChatModule 类,供 AppModule 引入
export class ChatModule {}
