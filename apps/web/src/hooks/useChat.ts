// useChat — 聊天发送/停止核心 Hook
// 封装 sendMessage + chatStream SSE 流式 + processChunk + abort 逻辑
// 从 chatStore/uiStore/configStore/sessionStore 读取状态,避免 ChatPage 直接管理
import { useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { useConfigStore } from '../store/configStore';
import { useSessionStore } from '../store/sessionStore';
import { chatStream } from '../lib/api';
import type { Message, StreamChunk, AppMode } from '@ai-voice/shared';

/** 根据消息文本生成会话标题(取前 30 字) */
function makeTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 30 ? t.slice(0, 30) + '...' : t;
}

export function useChat() {
  const abortRef = useRef<AbortController | null>(null);

  const streaming = useChatStore((s) => s.streaming);
  const setMessages = useChatStore((s) => s.setMessages);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setActiveAgents = useChatStore((s) => s.setActiveAgents);
  const resetStreamState = useChatStore((s) => s.resetStreamState);
  const addAssistantPlaceholder = useChatStore((s) => s.addAssistantPlaceholder);
  const processChunk = useChatStore((s) => s.processChunk);
  const setSendError = useChatStore((s) => s.setSendError);

  const modes = useUIStore((s) => s.modes);
  const images = useUIStore((s) => s.images);
  const clearImages = useUIStore((s) => s.clearImages);
  const setSlashVisible = useUIStore((s) => s.setSlashVisible);
  const selectedSkill = useUIStore((s) => s.selectedSkill);

  const selectedConfigId = useConfigStore((s) => s.selectedConfigId);

  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const conversations = useSessionStore((s) => s.conversations);
  const newSession = useSessionStore((s) => s.newSession);
  const setCurrentSessionId = useSessionStore((s) => s.setCurrentSessionId);

  // 当前生效模式:modes 首项,空数组默认 exec
  const effectiveMode: AppMode = modes.length > 0 ? modes[0] : 'exec';

  /**
   * sendMessage — 发送消息
   * @param text 文本内容(由 ChatPage 从 editor.getText() 传入)
   * @param resume 是否为重试模式(不添加新 user 消息)
   */
  const sendMessage = (text: string, resume = false) => {
    if (streaming) return;
    if (!text && images.length === 0 && !resume) return;

    // 确定 sessionId:无当前会话则生成新 UUID
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCurrentSessionId(sessionId);
    }

    // 非重试:添加 user 消息 + 首条消息时加入会话列表
    if (!resume) {
      const userMsg: Message = {
        role: 'user',
        content: text,
        images: images.length > 0 ? images : undefined,
      };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        // 首条消息且会话不在列表中:添加到会话列表
        if (prev.length === 0 && !conversations.find((c) => c.id === sessionId)) {
          newSession(sessionId!, makeTitle(text || 'New Session'));
        }
        return next;
      });
      setSlashVisible(false);
    }

    // 保存图片快照(发送前清空)
    const savedImages = [...images];
    // 重置流式状态
    resetStreamState();
    clearImages();
    // 添加 assistant 占位消息
    addAssistantPlaceholder();

    // SSE 流式请求
    (async () => {
      try {
        const controller = new AbortController();
        abortRef.current = controller;

        // 获取活跃的 MCP 服务器配置
        let mcpServers: Array<{
          name: string;
          transport: string;
          command: string | null;
          url: string | null;
          env: Record<string, string> | null;
        }> = [];
        if (effectiveMode === 'mcp') {
          try {
            const servers = await api.mcpServers.list();
            mcpServers = servers
              .filter((s) => s.isActive)
              .map((s) => ({
                name: s.name,
                transport: s.transport,
                command: s.command ?? null,
                url: s.url ?? null,
                env: s.env ?? null,
              }));
          } catch {
            // 获取 MCP 服务器失败时继续执行，不阻塞聊天
          }
        }

        await chatStream(
          {
            sessionId: sessionId!,
            content: text,
            mode: effectiveMode,
            configId: selectedConfigId ?? undefined,
            images: savedImages,
            skill: effectiveMode === 'skills' ? (selectedSkill ?? undefined) : undefined,
            mcpServers,
          },
          (chunk) => processChunk(chunk as StreamChunk),
          controller.signal,
        );
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name !== 'AbortError') {
          const message = err instanceof Error ? err.message : 'SSE error';
          // 友好化错误消息
          const friendlyMessage =
            message.includes('Network') || message.includes('fetch')
              ? '网络连接失败，请检查网络后重试'
              : message.includes('timeout')
                ? '请求超时，请稍后重试'
                : message.includes('500')
                  ? '服务器暂时不可用，请稍后重试'
                  : message.includes('401')
                    ? '登录已过期，请重新登录'
                    : message.includes('403')
                      ? '您没有权限执行此操作'
                      : message;
          setSendError(friendlyMessage);
        }
      }
      setStreaming(false);
      setActiveAgents([]);
    })();
  };

  /** stopGeneration — 中断 SSE 请求,标记最后一条 assistant 消息为已中断 */
  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages((prev) => {
      const u = [...prev];
      if (u.length > 0 && u[u.length - 1].role === 'assistant') {
        u[u.length - 1] = { ...u[u.length - 1], interrupted: true, interruptReason: 'user' };
      }
      return u;
    });
    setStreaming(false);
    setActiveAgents([]);
  };

  return { sendMessage, stopGeneration, streaming };
}
