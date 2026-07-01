// API 客户端封装层
// 统一管理所有 HTTP 请求:自动注入 JWT token、统一错误处理、SSE 流式解析
import type {
  Message,
  User,
  Session,
  ModelConfig,
  McpServerConfig,
  SkillInfo,
} from '@ai-voice/shared';

// API 基础 URL — 从 Vite 环境变量读取,默认空串走 Vite 代理(开发环境)
// 生产环境在 .env 中配置 VITE_API_URL 为实际后端地址
const API_URL = import.meta.env.VITE_API_URL ?? '';

// localStorage 键名 — 存储登录 token
const TOKEN_KEY = 'auth_token';

/** 读取 localStorage 中的 JWT token */
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * apiFetch — 统一的 fetch 封装
 * 自动拼接 API_URL 前缀、注入 Authorization header、处理 401 跳转
 * @param path 相对路径,如 '/api/model-configs'
 * @param init fetch init 配置
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  // 注入 Bearer token
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // 有 body 但未指定 Content-Type 时,默认 JSON
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const isAuthPath = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register');
  // 401 清除 token 并跳转登录页（认证接口本身除外）
  if (res.status === 401 && !isAuthPath) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }
  if (res.status === 403) {
    throw new Error('您没有权限执行此操作');
  }
  if (res.status === 404) {
    throw new Error('请求的资源不存在');
  }
  if (res.status === 500) {
    throw new Error('服务器内部错误，请稍后重试');
  }
  // 非 2xx 响应：解析服务器错误信息并抛出
  if (!res.ok) {
    let errorMessage = `请求失败 (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.message === 'string') {
        errorMessage = body.message;
      } else if (Array.isArray(body.message) && body.message.length > 0) {
        errorMessage = body.message.join(', ');
      }
    } catch {
      /* 忽略解析失败 */
    }
    throw new Error(errorMessage);
  }
  return res;
}

/** 提取响应 JSON 的便捷函数 */
const json = <T = unknown>(res: Response): Promise<T> => res.json();

/**
 * chatStream — SSE 流式聊天请求封装
 * 解析 'data: {...}\n' 格式的 SSE 响应,逐 chunk 回调
 * @param body 请求体(含 sessionId/content/mode/configId 等)
 * @param onChunk 每个 SSE 事件的回调
 * @param signal AbortSignal,用于取消请求
 */
export async function chatStream(
  body: Record<string, unknown>,
  onChunk: (chunk: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Chat stream failed: ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          onChunk(JSON.parse(line.slice(6)));
        } catch {
          /* 跳过无法解析的行 */
        }
      }
    }
  }
}

// API 对象 — 按模块组织所有 CRUD 方法
export const api = {
  // 认证相关
  auth: {
    register: (d: { name: string; email: string; password: string }) =>
      apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(d) }).then(
        json<{ accessToken: string; user: User }>,
      ),
    login: (d: { email: string; password: string }) =>
      apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(d) }).then(
        json<{ accessToken: string; user: User }>,
      ),
    me: () => apiFetch('/api/auth/me').then(json<User>),
  },
  // 模型配置相关
  configs: {
    list: () => apiFetch('/api/model-configs').then(json<ModelConfig[]>),
    create: (d: unknown) =>
      apiFetch('/api/model-configs', { method: 'POST', body: JSON.stringify(d) }).then(
        json<ModelConfig>,
      ),
    update: (id: string, d: unknown) =>
      apiFetch(`/api/model-configs/${id}`, { method: 'PUT', body: JSON.stringify(d) }).then(
        json<ModelConfig>,
      ),
    delete: (id: string) => apiFetch(`/api/model-configs/${id}`, { method: 'DELETE' }),
    select: (id: string) =>
      apiFetch(`/api/model-configs/${id}/select`, { method: 'PATCH' }).then(json<ModelConfig>),
    selected: () => apiFetch('/api/model-configs/selected').then(json<ModelConfig | null>),
  },
  // 会话相关
  sessions: {
    list: () => apiFetch('/api/sessions').then(json<Session[]>),
    create: (d?: { title?: string }) =>
      apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify(d ?? {}) }).then(
        json<Session>,
      ),
    get: (id: string) => apiFetch(`/api/sessions/${id}`).then(json<Session>),
    update: (id: string, d: { title?: string }) =>
      apiFetch(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(d) }).then(
        json<Session>,
      ),
    delete: (id: string) => apiFetch(`/api/sessions/${id}`, { method: 'DELETE' }),
    messages: (id: string) => apiFetch(`/api/sessions/${id}/messages`).then(json<Message[]>),
  },
  // 内置技能列表
  skills: {
    list: () => apiFetch('/api/skills').then(json<SkillInfo[]>),
  },
  // MCP 服务器配置
  mcpServers: {
    list: () => apiFetch('/api/mcp-servers').then(json<McpServerConfig[]>),
    create: (d: unknown) =>
      apiFetch('/api/mcp-servers', { method: 'POST', body: JSON.stringify(d) }).then(
        json<McpServerConfig>,
      ),
    update: (id: string, d: unknown) =>
      apiFetch(`/api/mcp-servers/${id}`, { method: 'PATCH', body: JSON.stringify(d) }).then(
        json<McpServerConfig>,
      ),
    delete: (id: string) => apiFetch(`/api/mcp-servers/${id}`, { method: 'DELETE' }),
  },
};
