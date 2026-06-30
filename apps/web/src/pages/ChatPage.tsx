// ChatPage — 聊天主页(薄壳组件)
// 仅做布局组合 + Hook 调用 + editor 配置
// 状态管理委托给 zustand store,业务逻辑委托给 hooks
import { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useChat } from '../hooks/useChat';
import { useSlashCommands } from '../hooks/useSlashCommands';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { useConfigStore } from '../store/configStore';
import { useSessionStore } from '../store/sessionStore';
import { MODE_LABELS } from '../components/slashCommands';
import MessageList from '../chat/MessageList';
import ChatInput from '../chat/ChatInput';
import type { AppMode } from '@ai-voice/shared';

export default function ChatPage() {
  const navigate = useNavigate();
  const { sendMessage, stopGeneration, streaming } = useChat();
  const { handleKeyDown: handleSlashKeyDown } = useSlashCommands();

  // 从 chatStore 读取渲染所需状态
  const messages = useChatStore((s) => s.messages);
  const activeAgents = useChatStore((s) => s.activeAgents);
  const planSteps = useChatStore((s) => s.planSteps);
  const agentPlans = useChatStore((s) => s.agentPlans);
  const collapseAgents = useChatStore((s) => s.collapseAgents);
  const setCollapseAgents = useChatStore((s) => s.setCollapseAgents);

  // 从 uiStore 读取斜杠命令面板控制函数
  const modes = useUIStore((s) => s.modes);
  const setSlashQuery = useUIStore((s) => s.setSlashQuery);
  const setSlashVisible = useUIStore((s) => s.setSlashVisible);
  const setSelectedIdx = useUIStore((s) => s.setSelectedIdx);

  // 从 configStore 读取模型配置
  const selectedConfigId = useConfigStore((s) => s.selectedConfigId);
  const configs = useConfigStore((s) => s.configs);
  const loadConfigs = useConfigStore((s) => s.loadConfigs);

  const loadConversations = useSessionStore((s) => s.loadConversations);

  const endRef = useRef<HTMLDivElement>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ref 保存最新函数/实例引用,避免 useEditor 闭包陈旧(Tiptap 仅首次渲染初始化)
  const slashKeyDownRef = useRef(handleSlashKeyDown);
  const sendRef = useRef<(resume?: boolean) => void>(() => {});
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    slashKeyDownRef.current = handleSlashKeyDown;
  }, [handleSlashKeyDown]);

  const selectedConfig = configs.find((c) => c.id === selectedConfigId) ?? null;
  const effectiveMode: AppMode = modes.length > 0 ? modes[0] : 'exec';

  // handleSend 通过 editorRef 访问 editor,避免 TDZ 与闭包陈旧
  const handleSend = useCallback(
    (resume = false) => {
      const ed = editorRef.current;
      if (!ed || streaming) return;
      const text = ed.getText().trim();
      sendMessage(text, resume);
      if (!resume && !ed.isDestroyed) ed.commands.clearContent();
    },
    [streaming, sendMessage],
  );

  useEffect(() => {
    sendRef.current = handleSend;
  }, [handleSend]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, bold: false, italic: false }),
      Placeholder.configure({ placeholder: '想说点什么?按 / 选模式,或上传图片...' }),
    ],
    editorProps: {
      attributes: { class: 'outline-none text-[14px] text-[#1A1A2E]' },
      handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
        // 命令面板显示时,交给 useSlashCommands 处理
        if (slashKeyDownRef.current(event)) return true;
        // Enter 发送,Shift/Alt+Enter 换行
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          sendRef.current();
          return true;
        }
        return false;
      },
    },
  });
  editorRef.current = editor;

  // 挂载时加载配置和会话列表
  useEffect(() => {
    loadConfigs();
    loadConversations();
  }, [loadConfigs, loadConversations]);

  // 编辑器 "/" 检测:触发斜杠命令面板
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const handler = () => {
      const text = editor.getText();
      if (!text) {
        setSlashVisible(false);
        setSlashQuery('');
        return;
      }
      const pos = editor.state.selection.$head.parent.textContent || '';
      const idx = pos.lastIndexOf('/');
      if (idx >= 0 && (idx === 0 || pos[idx - 1] === ' ')) {
        const q = pos.slice(idx);
        if (q.length <= 50 && !q.includes('\n')) {
          setSlashQuery(q);
          setSlashVisible(true);
          setSelectedIdx(0);
          return;
        }
      }
      setSlashVisible(false);
      setSlashQuery('');
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, setSlashVisible, setSlashQuery, setSelectedIdx]);

  // 消息/计划变化时自动滚动到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, planSteps, activeAgents]);

  // 全部 Agent/步骤完成后,延迟 1 秒折叠详情
  useEffect(() => {
    if (collapseAgents) return;
    const agentNames = Object.keys(agentPlans);
    const agentsDone =
      agentNames.length > 0 &&
      agentNames.every((name) => {
        const steps = agentPlans[name];
        return (
          steps.length > 0 && steps.every((s) => s.status === 'completed' || s.status === 'failed')
        );
      });
    const planDone =
      planSteps.length > 0 &&
      planSteps.every((s) => s.status === 'completed' || s.status === 'failed');
    if (agentsDone || planDone) {
      collapseTimerRef.current = setTimeout(() => setCollapseAgents(true), 1000);
      return () => {
        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      };
    }
  }, [agentPlans, planSteps, collapseAgents, setCollapseAgents]);

  // 窗口 focus 时重新加载配置(从设置页返回后自动同步)
  useEffect(() => {
    const handler = () => loadConfigs();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [loadConfigs]);

  return (
    <main className="flex flex-1 flex-col min-w-0 bg-[#FFFFFF]">
      <header className="flex items-center justify-between border-b border-[#EBECF0] h-16 px-6 flex-shrink-0">
        <span className="text-[15px] font-semibold text-[#1A1A2E]">智能助手</span>
        <span className="text-[11px] text-[#999]">
          {selectedConfig
            ? `${selectedConfig.modelProvider}/${selectedConfig.modelName}`
            : '未配置模型'}{' '}
          · {MODE_LABELS[effectiveMode] ?? effectiveMode}
        </span>
      </header>

      {/* 活跃 Agent 列表:仅多智能体执行时显示 */}
      {activeAgents.length > 0 && (
        <div className="flex gap-2 border-b border-[#EBECF0] bg-[#F5F6FA] px-6 py-1.5">
          {activeAgents.map((a) => (
            <span
              key={a.agent}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{
                borderColor: a.color + '40',
                color: a.color,
                backgroundColor: a.color + '15',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: a.color }}
              />{' '}
              {a.name}
            </span>
          ))}
        </div>
      )}

      <MessageList endRef={endRef} onRetry={() => handleSend(true)} editor={editor} />
      <ChatInput
        editor={editor}
        onSend={() => handleSend()}
        onStop={stopGeneration}
        onNavigateSettings={() => navigate('/settings')}
      />
    </main>
  );
}
