// LoginPage — 登录/注册页面
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === 'register' && !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        await api.auth.register({ name: name.trim(), email: email.trim(), password });
      }
      const res = await api.auth.login({ email: email.trim(), password });
      login(res.access_token, res.user);
      navigate('/');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Authentication failed';
      setError(message);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#F5F6FA]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-center text-[20px] font-bold text-[#1A1A2E]">
          {mode === 'login' ? '登录' : '注册'}
        </h1>
        {mode === 'register' && (
          <input
            type="text"
            placeholder="用户名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full rounded-lg border border-[#EBECF0] px-3 py-2 text-[14px] outline-none focus:border-[#6366F1]"
          />
        )}
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-[#EBECF0] px-3 py-2 text-[14px] outline-none focus:border-[#6366F1]"
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="mb-3 w-full rounded-lg border border-[#EBECF0] px-3 py-2 text-[14px] outline-none focus:border-[#6366F1]"
        />
        {error && <p className="mb-3 text-[12px] text-[#EF4444]">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-[#6366F1] py-2.5 text-[14px] font-medium text-white hover:bg-[#5558E6] disabled:opacity-50"
        >
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>
        <p className="mt-4 text-center text-[12px] text-[#999]">
          {mode === 'login' ? '没有账号?' : '已有账号?'}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="ml-1 text-[#6366F1] hover:underline"
          >
            {mode === 'login' ? '注册' : '登录'}
          </button>
        </p>
      </div>
    </div>
  );
}
