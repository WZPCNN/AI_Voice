// AuthGuard — 路由守卫,未登录用户重定向到 /login
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // 正在验证 token 时显示加载状态
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F6FA]">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent mx-auto" />
          <p className="text-[14px] text-[#999]">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
