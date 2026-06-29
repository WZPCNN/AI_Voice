// Vite 配置文件 — 前端构建工具配置
// 文档:https://vitejs.dev/config/

// defineConfig — Vite 配置工厂函数,提供类型提示
import { defineConfig } from 'vite';
// @vitejs/plugin-react — Vite 的 React 插件
// 提供 Fast Refresh(热更新)、JSX 转换等能力
import react from '@vitejs/plugin-react';

// 默认导出配置对象
export default defineConfig({
  // 插件列表
  plugins: [
    react(), // 启用 React 支持
  ],
  // 开发服务器配置
  server: {
    // 端口号 — 前端运行在 3000 端口
    port: 3000,
    // 代理配置 — 将前端请求转发到后端,避免跨域
    proxy: {
      // 所有 /api 开头的请求转发到后端服务(运行在 4000 端口)
      '/api': 'http://localhost:4000',
      // SSE 流式聊天端点(虽在 /api/chat/stream 下,额外覆盖确保代理生效)
      '/chat': 'http://localhost:4000',
    },
  },
});
