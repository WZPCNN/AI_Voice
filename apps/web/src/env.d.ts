// 三斜杠指令:引入 vite/client 类型声明
// 这让 TypeScript 识别 Vite 特有的功能,例如:
//   - import.meta.env — 访问环境变量(如 import.meta.env.VITE_API_URL)
//   - import.meta.glob — 批量导入模块
//   - 静态资源导入(*.css、*.png、*.svg 等)的模块类型
// 该文件本身是 Vite 项目的环境类型声明文件(env.d.ts 是约定俗成的命名)
/// <reference types="vite/client" />
