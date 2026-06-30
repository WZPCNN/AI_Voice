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
        const res = await api.auth.register({ name: name.trim(), email: email.trim(), password });
        login(res.accessToken, res.user);
        navigate('/');
        return;
      }
      const res = await api.auth.login({ email: email.trim(), password });
      login(res.accessToken, res.user);
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
            placeholder="请输入用户名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full rounded-lg border border-[#EBECF0] px-3 py-2 text-[14px] outline-none focus:border-[#6366F1]"
          />
        )}
        <input
          type="email"
          placeholder="请输入邮箱地址"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-[#EBECF0] px-3 py-2 text-[14px] outline-none focus:border-[#6366F1]"
        />
        <input
          type="password"
          placeholder={mode === 'register' ? '请输入密码（至少8位）' : '请输入密码'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="mb-3 w-full rounded-lg border border-[#EBECF0] px-3 py-2 text-[14px] outline-none focus:border-[#6366F1]"
        />
        {error && (
          <div className="mb-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-3 py-2">
            <p className="text-[12px] text-[#DC2626]">{error}</p>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-[#6366F1] py-2.5 text-[14px] font-medium text-white hover:bg-[#5558E6] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>{mode === 'login' ? '登录中...' : '注册中...'}</span>
            </>
          ) : mode === 'login' ? (
            '登录'
          ) : (
            '注册'
          )}
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
