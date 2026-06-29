// 根 ESLint Flat Config — 供整个 monorepo 共享
// 基础配置来自 @agent-platform/eslint-config,React 配置仅应用于 apps/web
// 文档:https://eslint.org/docs/latest/use/configure/configuration-files
import baseConfig, { reactConfig } from '@agent-platform/eslint-config/base';

export default [
  // 1. 全局忽略:构建产物与依赖目录
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/*.generated.*',
    ],
  },
  // 2. 基础配置(所有 .ts/.tsx 文件):ESLint 推荐 + TypeScript 推荐 + Prettier 兼容
  ...baseConfig,
  // 3. React 配置(仅 apps/web):react-hooks + react-refresh
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: reactConfig[0].plugins,
    rules: {
      ...reactConfig[0].rules,
      // react-hooks 7.x 新增规则较为严格,现有代码暂降级为 warning
      // refs: 禁止 render 中访问 ref.current(现有 Tiptap editorRef 模式需要)
      // set-state-in-effect: 禁止 effect 中直接 setState(数据加载场景常见)
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
