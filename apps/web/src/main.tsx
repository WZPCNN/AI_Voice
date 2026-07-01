// 从 react 导入 StrictMode 组件
// StrictMode 会在开发模式下对组件进行额外检查,帮助发现潜在问题(如副作用重复执行)
import { StrictMode } from "react";
// 从 react-dom/client 导入 createRoot — React 18+ 的新挂载 API
import { createRoot } from "react-dom/client";
// 从 react-router-dom 导入 BrowserRouter — HTML5 history 模式的路由器
// 它使用 URL 路径管理导航,需要后端配置支持(所有路由都返回 index.html)
import { BrowserRouter } from "react-router-dom";
// 导入根组件 App,负责定义路由表
import App from "./App";
// 导入全局样式表(包含 Tailwind 指令和自定义样式)
import "./index.css";
// 导入认证 store,用于初始化时验证 token
import { useAuthStore } from "./store/authStore";

// 应用启动时验证 token 有效性
// 如果 localStorage 中有 token,调用 /api/auth/me 验证
// 验证失败会清除 token 并设置 isAuthenticated = false
const token = localStorage.getItem("auth_token");
if (token) {
  useAuthStore.getState().loadMe();
}

// createRoot — 在 #root DOM 节点上创建 React 根容器
// document.getElementById("root") — 获取 index.html 中的根 div
// ! 非空断言:声明该元素一定存在(若不存在运行时会报错)
createRoot(document.getElementById("root")!).render(
  // StrictMode 包裹整个应用,启用额外检查(仅开发模式生效)
  <StrictMode>
    {/* BrowserRouter 提供 history 路由能力,使 App 内可使用 <Routes>/<Route> */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
