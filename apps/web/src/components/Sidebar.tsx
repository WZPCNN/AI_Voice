/**
 * 会话侧边栏。
 * Conversation sidebar component.
 *
 * 动态会话列表:初始为空,首次对话后自动生成标题(取消息前 30 字作为关键词)。
 * "+" 按钮新建会话。
 * Dynamic conversation list: initially empty, auto-generates title (first 30 chars of message) after first chat.
 * The "+" button creates a new session.
 *
 * @module Sidebar
 */

// 从 lucide-react 导入侧边栏所需的图标组件
// Search — 搜索图标
// Plus — 新建(加号)图标
// MessageSquare — 会话项图标
// Settings — 设置图标
// Trash2 — 删除图标
import { Search, Plus, MessageSquare, Settings, Trash2 } from 'lucide-react';

/**
 * Conversation — 单个会话记录的数据结构
 * 由父组件(ChatPage)维护,传入 Sidebar 渲染
 */
export interface Conversation {
  // 会话唯一 ID(用 crypto.randomUUID() 生成)
  id: string;
  // 会话标题(取首条消息前 30 字)
  title: string;
}

/**
 * SidebarProps — Sidebar 组件的 props 类型
 */
interface SidebarProps {
  // 会话列表
  conversations: Conversation[];
  // 当前激活的会话 ID(用于高亮)
  activeId: string;
  // 选择会话的回调
  onSelect: (id: string) => void;
  // 新建会话的回调
  onNewSession: () => void;
  // 删除会话的回调
  onDelete: (id: string) => void;
  // 打开设置页的回调(可选)
  onSettings?: () => void;
}

/**
 * Sidebar — 侧边栏组件
 * 包含三部分:头部(标题+新建)、搜索框、会话列表、底部设置按钮
 */
export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewSession,
  onDelete,
  onSettings,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-[#EBECF0] bg-gradient-to-b from-[#FAFBFC] to-[#FFFFFF] relative">
      {/* 头部:标题"会话" + 新建按钮 */}
      <div className="flex items-center justify-between border-b border-[#EBECF0] px-5 py-0 h-16 bg-gradient-to-r from-[#F8F9FC] to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#6366F1] to-[#8B5CF6]" />
          <span className="text-[13px] font-semibold text-[#1A1A2E]">会话</span>
        </div>
        <button
          onClick={onNewSession}
          className="rounded-lg p-1.5 text-[#6366F1] hover:bg-[#6366F118] transition-all shadow-sm hover:shadow"
          title="新建会话"
          aria-label="新建会话"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* 搜索框区域 */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-white border border-[#E8E8EC] px-3.5 py-2.5 shadow-sm hover:shadow transition-all focus-within:border-[#6366F1] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]">
          <Search size={14} className="text-[#999]" aria-hidden="true" />
          <input
            className="flex-1 bg-transparent text-[12px] text-[#1A1A2E] outline-none placeholder:text-[#BBB]"
            placeholder="搜索历史会话..."
            aria-label="搜索会话"
          />
        </div>
      </div>

      {/* 会话列表区域:可滚动 */}
      <div
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        role="listbox"
        aria-label="会话列表"
      >
        {/* 空状态提示 */}
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-8 py-8 px-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F0F1F5] to-[#E8E8EC] flex items-center justify-center mb-3 shadow-sm">
              <MessageSquare size={22} className="text-[#999]" />
            </div>
            <p className="text-[13px] text-[#666] text-center font-medium">暂无历史会话</p>
            <p className="text-[11px] text-[#999] text-center mt-1.5 leading-relaxed">
              点击右上角{' '}
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#6366F118] text-[#6366F1] text-[10px]">
                +
              </span>{' '}
              开始新对话
            </p>
          </div>
        )}
        {/* 遍历渲染每个会话项 */}
        {conversations.map((conv) => (
          <div key={conv.id} className="group relative">
            <div
              role="option"
              aria-selected={conv.id === activeId}
              onClick={() => onSelect(conv.id)}
              className={
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all ' +
                (conv.id === activeId
                  ? 'bg-gradient-to-r from-[#6366F118] to-[#8B5CF618] border border-[#6366F140] shadow-sm'
                  : 'hover:bg-[#F5F6FA] border border-transparent hover:border-[#E8E8EC]')
              }
            >
              <div
                className={
                  'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ' +
                  (conv.id === activeId
                    ? 'bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] shadow-sm'
                    : 'bg-[#F0F1F5] group-hover:bg-[#E8E8EC]')
                }
              >
                <MessageSquare
                  size={13}
                  className={conv.id === activeId ? 'text-white' : 'text-[#666]'}
                  aria-hidden="true"
                />
              </div>
              <span
                className={
                  'text-[12px] truncate flex-1 transition-colors ' +
                  (conv.id === activeId ? 'text-[#1A1A2E] font-medium' : 'text-[#666]')
                }
              >
                {conv.title}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#999] hover:text-[#EF4444] hover:bg-[#FEF2F2] opacity-0 group-hover:opacity-100 transition-all shadow-sm"
              title="删除会话"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      {/* 底部设置按钮 */}
      <div className="border-t border-[#EBECF0] px-3 py-3 bg-gradient-to-t from-[#F8F9FC] to-transparent">
        <button
          onClick={onSettings}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] text-[#666] hover:bg-[#F5F6FA] hover:text-[#1A1A2E] transition-all border border-transparent hover:border-[#E8E8EC] group"
          title="设置"
        >
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#F0F1F5] group-hover:bg-[#E8E8EC] flex items-center justify-center transition-all">
            <Settings
              size={13}
              className="text-[#666] group-hover:text-[#1A1A2E] transition-colors"
            />
          </div>
          <span className="font-medium">设置</span>
        </button>
      </div>
    </aside>
  );
}
