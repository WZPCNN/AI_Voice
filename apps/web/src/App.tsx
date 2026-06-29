// App — 应用根组件
// 路由配置:登录页(无认证) + 认证守卫包裹的主布局(含聊天和设置页) + 404
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

// 懒加载页面组件,减少首屏 bundle 体积
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// 简单的加载占位
function Loading() {
  return (
    <div className="flex h-screen items-center justify-center text-[#999] text-[14px]">
      加载中...
    </div>
  );
}

// 404 页面
function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center text-[#999] text-[14px]">
      页面不存在
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* 登录页:无需认证 */}
        <Route path="/login" element={<LoginPage />} />
        {/* 认证守卫:未登录重定向到 /login */}
        <Route element={<AuthGuard />}>
          {/* 主布局:Sidebar + Outlet */}
          <Route element={<Layout />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
