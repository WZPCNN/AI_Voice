// Prisma 配置文件 — 定义 Prisma CLI 的行为
// 文档:https://www.prisma.io/docs/reference/api-reference/prisma-config-reference

import 'dotenv/config';

// defineConfig — Prisma 配置工厂函数
// 用于类型安全地定义 Prisma 配置
import { defineConfig } from 'prisma/config';

// 默认导出配置对象
export default defineConfig({
  // schema — Prisma schema 文件路径
  // 定义数据库表结构、字段类型、关系等
  schema: 'prisma/schema.prisma',
  // migrations — 数据库迁移配置
  migrations: {
    // path — 迁移文件目录
    // 每次 prisma migrate dev 会在此目录生成新的迁移 SQL
    path: 'prisma/migrations',
  },
  // datasource — 数据源配置
  datasource: {
    // url — 数据库连接字符串
    // 从环境变量 DATABASE_URL 读取(在 .env 文件中定义)
    url: process.env.DATABASE_URL!,
  },
});
