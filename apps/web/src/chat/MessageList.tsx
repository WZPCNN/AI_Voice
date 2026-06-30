// MessageList — 消息列表组件
// 渲染空状态欢迎页 + 错误提示条 + 消息列表
// 从 chatStore 读取消息和计划状态,避免 ChatPage 直接管理
import { memo, useMemo, type RefObject } from 'react';
import {
  Sparkles,
  AlertCircle,
  Code2,
  SearchCheck,
  PenTool,
  Globe,
  Terminal,
  X,
} from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import type { Editor } from '@tiptap/react';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  endRef: RefObject<HTMLDivElement | null>;
  onRetry: () => void;
  editor: Editor | null;
}

// 快捷功能按钮配置
const QUICK_ACTIONS = [
  { icon: Code2, label: '代码', color: '#6366F1' },
  { icon: SearchCheck, label: '研究', color: '#10B981' },
  { icon: PenTool, label: '写作', color: '#F59E0B' },
  { icon: Globe, label: '搜索', color: '#3B82F6' },
  { icon: Terminal, label: '开发', color: '#8B5CF6' },
];

function MessageList({ endRef, onRetry, editor }: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const planMessageIdx = useChatStore((s) => s.planMessageIdx);
  const planSteps = useChatStore((s) => s.planSteps);
  const agentPlans = useChatStore((s) => s.agentPlans);
  const collapseAgents = useChatStore((s) => s.collapseAgents);
  const sendError = useChatStore((s) => s.sendError);
  const setSendError = useChatStore((s) => s.setSendError);

  const isEmpty = useMemo(() => messages.length === 0, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {/* 空状态:欢迎页 + 快捷功能按钮 */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center mb-4 shadow-lg">
            <Sparkles size={32} className="text-white" />
          </div>
          <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-2">有什么可以帮你的?</h2>
          <p className="text-[13px] text-[#999] mb-6 max-w-sm">
            输入消息开始对话，或输入{' '}
            <kbd className="px-1.5 py-0.5 rounded border border-[#E8E8EC] bg-white text-[11px] font-mono">
              /
            </kbd>{' '}
            查看可用命令
          </p>
          <div className="flex gap-2 flex-wrap justify-center max-w-md">
            {QUICK_ACTIONS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#EBECF0] px-3.5 py-2 text-[12px] text-[#1A1A2E] hover:bg-[#F5F6FA] hover:border-[#D4D6DD] transition-all shadow-sm hover:shadow"
                onClick={() => {
                  editor?.commands.setContent(chip.label + ' ');
                  editor?.commands.focus();
                }}
              >
                <chip.icon size={13} style={{ color: chip.color }} /> {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 错误提示条 */}
      {sendError && (
        <div className="mx-auto max-w-2xl flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-[#FEF2F2] to-[#FFF5F5] border border-[#FECACA] px-4 py-3 shadow-sm">
          <AlertCircle size={15} className="flex-shrink-0 text-[#EF4444] mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[#DC2626] font-medium mb-0.5">发送失败</p>
            <p className="text-[11px] text-[#999] leading-relaxed">{sendError}</p>
          </div>
          <button
            className="flex-shrink-0 rounded-lg p-1 text-[#999] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
            onClick={() => setSendError(null)}
            title="关闭提示"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 消息列表 */}
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id ?? i}
          msg={msg}
          index={i}
          isLast={i === messages.length - 1}
          streaming={streaming}
          planMessageIdx={planMessageIdx}
          planSteps={planSteps}
          agentPlans={agentPlans}
          collapseAgents={collapseAgents}
          onRetry={onRetry}
        />
      ))}
      {/* 底部锚点:用于自动滚动 */}
      <div ref={endRef} />
    </div>
  );
}

export default memo(MessageList);
