import 'dotenv/config';
// 从 @nestjs/common 导入 Injectable、OnModuleInit、OnModuleDestroy 装饰器和生命周期接口
// Injectable — 标记该类可被 NestJS 依赖注入系统管理
// OnModuleInit — 模块初始化时调用的生命周期钩子接口
// OnModuleDestroy — 模块销毁时调用的生命周期钩子接口
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// 从 @prisma/client 导入 PrismaClient 基类,提供数据库操作 API
import { PrismaClient } from '@prisma/client';
// 从 @prisma/adapter-pg 导入 PrismaPg 适配器
// Prisma 7+ 不再内置数据库驱动,需通过 adapter 显式指定 PostgreSQL 驱动实现
import { PrismaPg } from '@prisma/adapter-pg';

// 从环境变量读取数据库连接字符串
// process.env.DATABASE_URL — 在 .env 中配置,形如 postgresql://user:pass@host:port/db
// 末尾 ! 是 TypeScript 非空断言,声明此值一定存在(运行时若缺失会得到 undefined)
const connectionString = `${process.env.DATABASE_URL!}`;

// 创建 PostgreSQL 驱动适配器,Prisma 7 不再内置数据库驱动,需要显式指定
// adapter 会接管底层连接池、参数绑定等细节,PrismaClient 通过它发送查询到 PostgreSQL
const adapter = new PrismaPg({ connectionString });

/**
 * PrismaService — Prisma 客户端的 NestJS 封装
 * 继承 PrismaClient 意味着本类直接拥有 prisma.xxx.findMany / create / update 等方法
 * 实现 OnModuleInit、OnModuleDestroy 让其在 NestJS 生命周期内自动管理数据库连接
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // 构造函数:调用父类 PrismaClient 的构造函数,传入 adapter 指定数据库驱动
  constructor() {
    super({ adapter });
  }

  // 模块初始化钩子:NestJS 启动时自动调用
  // 调用 $connect() 建立与数据库的连接,确保后续查询可用
  async onModuleInit() {
    await this.$connect();
  }

  // 模块销毁钩子:NestJS 优雅关闭时自动调用
  // 调用 $disconnect() 释放连接池资源,避免连接泄漏
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
