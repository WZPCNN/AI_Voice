// McpModule — MCP 服务器配置模块
// 整合控制器和服务,导出 McpService 供 ChatModule 使用
import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
