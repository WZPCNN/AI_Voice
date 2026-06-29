// Jest 测试环境预设 — 在所有测试前加载
// 设置 crypto.ts 模块加载时必需的环境变量(32 字节 hex = 64 字符)
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';
