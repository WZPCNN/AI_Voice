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
import { Search, Plus, MessageSquare, Settings, Trash2 } from "lucide-react";

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
export default function Sidebar({ conversations, activeId, onSelect, onNewSession, onDelete, onSettings }: SidebarProps) {
  return (
    // aside — 语义化标签,表示侧边栏
    // flex h-full w-[260px] — 260px 固定宽度,高度填满父容器
    // flex-col — 垂直布局
    // border-r — 右边框
    // bg-[#FFFFFF] — 白色背景
    <aside className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-[#EBECF0] bg-[#FFFFFF] relative">
      {/* 头部:标题"会话" + 新建按钮 */}
      <div className="flex items-center justify-between border-b border-[#EBECF0] px-5 py-0 h-16">
        <span className="text-[13px] font-semibold text-[#1A1A2E]">会话</span>
        {/* 新建会话按钮:点击触发 onNewSession */}
        <button onClick={onNewSession} className="rounded-md p-1 text-[#8888AA] hover:bg-[#F0F1F5] hover:text-[#1A1A2E] transition-colors" title="新建会话" aria-label="新建会话"><Plus size={18} /></button>
      </div>

      {/* 搜索框区域 */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg bg-[#F0F1F5] px-3.5 py-2.5">
          <Search size={14} className="text-[#999]" aria-hidden="true" />
          {/* 搜索输入框(当前仅 UI,未实现实际过滤逻辑) */}
          <input className="flex-1 bg-transparent text-[12px] text-[#1A1A2E] outline-none placeholder:text-[#999]" placeholder="搜索会话..." aria-label="搜索会话" />
        </div>
      </div>

      {/* 会话列表区域:可滚动 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" role="listbox" aria-label="会话列表">
        {/* 空状态提示 */}
        {conversations.length === 0 && (
          <p className="text-[12px] text-[#999] text-center mt-4">暂无历史会话</p>
        )}
        {/* 遍历渲染每个会话项 */}
        {conversations.map((conv) => (
          // group — Tailwind 的分组容器,允许子元素通过 group-hover 响应父元素 hover
          <div key={conv.id} className="group relative">
            <div
              role="option"
              // 标记当前是否被选中(用于无障碍辅助技术)
              aria-selected={conv.id === activeId}
              // 点击会话项触发 onSelect
              onClick={() => onSelect(conv.id)}
              // 动态 className:选中时使用浅紫底色,否则 hover 时使用浅灰底色
              className={"flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors " + (conv.id === activeId ? "bg-[#EEF2FF]" : "hover:bg-[#F5F6FA]")}
            >
              {/* 会话图标:选中时靛蓝色,否则灰色 */}
              <MessageSquare size={14} className={conv.id === activeId ? "text-[#6366F1]" : "text-[#999]"} aria-hidden="true" />
              {/* 会话标题:截断过长文本(truncate),选中时加粗 */}
              <span className={"text-[12px] truncate flex-1 " + (conv.id === activeId ? "text-[#1A1A2E] font-medium" : "text-[#666]")}>{conv.title}</span>
            </div>
            {/* 删除按钮:仅当鼠标悬停在会话项上时显示(group-hover:opacity-100) */}
            <button
              // stopPropagation 阻止事件冒泡,避免触发外层会话项的 onSelect
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#999] hover:text-[#EF4444] hover:bg-[#FEF2F2] opacity-0 group-hover:opacity-100 transition-opacity"
              title="删除会话"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      {/* Settings button at bottom. 底部设置按钮 */}
      <div className="border-t border-[#EBECF0] px-3 py-3">
        <button
          onClick={onSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12px] text-[#666] hover:bg-[#F5F6FA] hover:text-[#1A1A2E] transition-colors"
          title="设置"
        >
          <Settings size={14} className="text-[#999]" />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
