// 从 @nestjs/common 导入 Module 装饰器,用于声明 NestJS 模块
import { Module } from "@nestjs/common";
// 导入 ModelConfigService — 模型配置业务服务,封装数据库 CRUD
import { ModelConfigService } from "./model-config.service";
// 导入 ModelConfigController — 模型配置 HTTP 控制器
import { ModelConfigController } from "./model-config.controller";

/**
 * ModelConfigModule — 模型配置模块
 * 整合模型配置的控制器和服务,并导出服务供其他模块(ChatModule)使用
 */
@Module({
  // providers:注册本模块的服务,ModelConfigService 作为单例维护
  providers: [ModelConfigService],
  // controllers:注册本模块的控制器,处理 /api/model-configs 路由
  controllers: [ModelConfigController],
  // exports:导出 ModelConfigService,使其他模块(如 ChatModule)可注入使用
  // ChatController 需要它来查询用户选中的模型配置
  exports: [ModelConfigService],
})
// 导出 ModelConfigModule 类,供 AppModule 引入
export class ModelConfigModule {}
