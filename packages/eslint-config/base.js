// ESLint 共享配置 — 供 monorepo 中所有包复用
// 采用 ESLint Flat Config 格式(ESLint 9+ 默认)
// 文档:https://eslint.org/docs/latest/use/configure/configuration-files

// @eslint/js — ESLint 官方推荐规则集
import eslint from '@eslint/js';
// typescript-eslint — TypeScript ESLint 支持
// 包含类型感知的规则和解析器
import tseslint from 'typescript-eslint';
// eslint-plugin-react-hooks — React Hooks 规则检查
// 确保 useEffect/useMemo 等依赖项正确
import reactHooks from 'eslint-plugin-react-hooks';
// eslint-plugin-react-refresh — React Refresh 规则检查
// 确保组件可安全热更新
import reactRefresh from 'eslint-plugin-react-refresh';
// eslint-config-prettier — 关闭与 Prettier 冲突的格式化规则
// 让 Prettier 负责格式化,ESLint 负责代码质量
import eslintConfigPrettier from 'eslint-config-prettier';

// 默认导出 — 基础 ESLint 配置(所有包通用)
// tseslint.config() 是 Flat Config 的辅助函数,支持数组展开
export default tseslint.config(
  // 1. ESLint 官方推荐规则
  eslint.configs.recommended,
  // 2. TypeScript ESLint 推荐规则(展开数组)
  ...tseslint.configs.recommended,
  // 3. 自定义规则
  {
    rules: {
      // no-unused-vars — 禁止未使用的变量
      // argsIgnorePattern: "^_" — 以 _ 开头的函数参数允许未使用(常见于回调签名)
      // varsIgnorePattern: "^_" — 以 _ 开头的局部变量允许未使用(如解构排除字段)
      // ignoreRestSiblings: true — 解构 rest 时,被排除的同级字段允许未使用(如 const { password: _, ...rest } = user)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // explicit-function-return-type — 关闭"必须显式标注函数返回类型"
      // 让 TypeScript 自动推断,减少样板代码
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  // 4. Prettier 兼容配置(必须放最后,以覆盖前面的格式化规则)
  eslintConfigPrettier,
);

// reactConfig — React 项目专用配置(命名导出)
// React 项目(apps/web)在基础配置之上追加此配置
export const reactConfig = tseslint.config({
  // 插件注册
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  // 规则配置
  rules: {
    // 展开 react-hooks 推荐规则(如 rules-of-hooks、exhaustive-deps)
    ...reactHooks.configs.recommended.rules,
    // react-refresh/only-export-components — 限制组件文件仅导出组件
    // 确保热更新能正确工作,allowConstantExport: true 允许导出常量
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
});
