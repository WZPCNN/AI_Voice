// useConversations — 会话列表管理 Hook
// 封装会话列表加载、新建、切换(含历史消息加载)、删除
// 从 sessionStore 读取会话列表,从 chatStore 读取/清空消息
import { useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useChatStore } from '../store/chatStore';
import { api } from '../lib/api';

export function useConversations() {
  const conversations = useSessionStore((s) => s.conversations);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const loadConversations = useSessionStore((s) => s.loadConversations);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const selectSession = useSessionStore((s) => s.selectSession);
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);

  const clearMessages = useChatStore((s) => s.clearMessages);
  const loadMessages = useChatStore((s) => s.loadMessages);

  /** 切换会话并加载历史消息 */
  const selectSessionWithMessages = useCallback(
    async (id: string) => {
      selectSession(id);
      setCurrentSessionId(id);
      try {
        const rawMsgs = await api.sessions.messages(id);
        // 后端返回 role 为大写(USER/ASSISTANT)，前端需要小写
        const msgs = rawMsgs.map((m) => ({
          ...m,
          role: m.role.toLowerCase() as 'user' | 'assistant' | 'tool' | 'agent',
        }));
        loadMessages(msgs);
      } catch {
        clearMessages();
      }
    },
    [selectSession, setCurrentSessionId, loadMessages, clearMessages],
  );

  /** 新建会话:清空当前会话和消息,不创建会话记录 */
  const createNewSession = useCallback(() => {
    setCurrentSessionId(null);
    clearMessages();
  }, [setCurrentSessionId, clearMessages]);

  return {
    conversations,
    currentSessionId,
    loadConversations,
    newSession: createNewSession,
    deleteSession,
    selectSession: selectSessionWithMessages,
  };
}
