// packages/shared 入口文件 — 统一导出所有共享类型
// 其他包(apps/api-server、apps/web)通过 @agent-platform/shared 引用这些类型

// 重新导出 types 目录下的所有类型定义
// 使用 .js 扩展名以兼容 nodenext 模块解析(api-server tsconfig)
export * from './types/index.js';
