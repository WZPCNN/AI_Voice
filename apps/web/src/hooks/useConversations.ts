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
  const newSessionInStore = useSessionStore((s) => s.newSession);
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
        const msgs = await api.sessions.messages(id);
        loadMessages(msgs);
      } catch {
        clearMessages();
      }
    },
    [selectSession, setCurrentSessionId, loadMessages, clearMessages],
  );

  /** 新建会话:生成 UUID + 添加到列表 + 清空消息 */
  const createNewSession = useCallback(() => {
    const id = crypto.randomUUID();
    newSessionInStore(id, 'New Session');
    clearMessages();
  }, [newSessionInStore, clearMessages]);

  return {
    conversations,
    currentSessionId,
    loadConversations,
    newSession: createNewSession,
    deleteSession,
    selectSession: selectSessionWithMessages,
  };
}
