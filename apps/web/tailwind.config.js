/** @type {import('tailwindcss').Config} */
// Tailwind CSS 配置文件
// 文档:https://tailwindcss.com/docs/configuration
// 使用 JSDoc 类型注解,提供 IDE 类型提示

// 默认导出配置对象
export default {
  // content — 内容扫描路径
  // Tailwind 会扫描这些文件中的类名,仅生成实际使用的 CSS(减少产物体积)
  content: [
    "./index.html",           // 入口 HTML
    "./src/**/*.{ts,tsx}",    // src 下所有 TypeScript 文件
  ],
  // theme — 主题扩展
  // 在此扩展默认主题(颜色、间距、字体等)
  theme: {
    extend: {},  // 当前未扩展,使用默认主题
  },
  // plugins — 插件列表
  // 可添加官方或第三方 Tailwind 插件(如 typography、forms 等)
  plugins: [],
};
