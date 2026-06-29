// PostCSS 配置文件 — CSS 后处理器配置
// 文档:https://postcss.org/

// 默认导出配置对象
export default {
  // 插件列表(按顺序执行)
  plugins: {
    // @tailwindcss/postcss — Tailwind CSS v4 的 PostCSS 插件
    // 扫描 HTML/TSX 中的类名,生成对应的 CSS 工具类
    "@tailwindcss/postcss": {},
    // autoprefixer — 自动添加浏览器厂商前缀
    // 如 transform -> -webkit-transform、-ms-transform
    autoprefixer: {},
  },
};
