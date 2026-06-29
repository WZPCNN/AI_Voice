// 从 @nestjs/common 导入 Global 和 Module 装饰器
// Global — 将模块标记为全局模块,注册一次后全应用可用,无需在各模块重复 import
// Module — 声明 NestJS 模块
import { Global, Module } from "@nestjs/common";
// 导入 PrismaService — Prisma 客户端封装,提供数据库访问能力
import { PrismaService } from "./prisma.service";

// @Global() 装饰器:将 PrismaModule 标记为全局模块
// 这样其他业务模块(如 ChatModule、ModelConfigModule)无需在 imports 中重复声明,
// 即可通过依赖注入直接使用 PrismaService
@Global()
@Module({
  // providers:声明本模块提供的可注入服务
  // 这里注册 PrismaService,NestJS 会创建单例并维护其生命周期
  providers: [PrismaService],
  // exports:导出 PrismaService,使其可被其他模块注入使用
  // 配合 @Global(),导出后全应用任意模块均可注入
  exports: [PrismaService],
})
// 导出 PrismaModule 类,供 AppModule 引入
export class PrismaModule {}
