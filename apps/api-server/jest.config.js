// Jest 配置 — api-server 单元测试
// 使用 ts-jest 转译 TypeScript,内联 compilerOptions 覆盖模块解析为 commonjs
// shared 包通过 moduleNameMapper 指向源码,无需预先构建
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@ai-voice/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          strict: true,
          target: 'ES2023',
          module: 'commonjs',
          moduleResolution: 'node',
          lib: ['ES2023'],
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          skipLibCheck: true,
          isolatedModules: false,
          types: ['jest', 'node'],
          baseUrl: '.',
          paths: {
            '@ai-voice/shared': ['../../packages/shared/src/index.ts'],
          },
        },
      },
    ],
  },
};
