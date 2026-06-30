// TypeScript version of the CSpell config.
// Requires Node.js >= 22.18 to run natively.
import { defineConfig } from 'cspell';

export default defineConfig({
  version: '0.2',
  dictionaryDefinitions: [
    {
      name: 'project-words',
      path: './.cspell/project-words.txt',
      addWords: true,
    },
  ],
  dictionaries: ['project-words'],
  ignorePaths: [
    'node_modules', // 前端依赖目录
    '.git', // Git 元数据目录
    'dist', // 构建产物目录
    '.venv', // Python 虚拟环境目录(包含大量第三方库源码)
    '__pycache__', // Python 字节码缓存目录
    'pnpm-lock.yaml', // pnpm 锁文件(含哈希等无需检查的内容)
    'uv.lock', // uv(Python 包管理器)锁文件
    './.cspell/project-words.txt',
    'cspell.config.mts',
  ],
});
