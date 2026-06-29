/**
 * Slash command definitions for the command palette.
 * 斜杠命令定义文件,用于聊天输入框的命令面板
 *
 * Activated by typing "/" in the chat input. Supports keyboard navigation
 * (Arrow keys + Enter + Escape) and mouse click selection.
 * 在输入框中键入 "/" 触发,支持键盘导航(↑↓ 选择、Enter 确认、Esc 关闭)和鼠标点击
 *
 * Multiple modes can be selected; default is Execute Mode when nothing selected.
 * 支持多模式叠加选择;未选择时默认为执行模式(Execute Mode)
 *
 * @module slashCommands
 */

// 从 lucide-react 导入图标组件
// Boxes — 多智能体图标(立方体组合)
// Blocks — 计划模式图标(模块拼装)
import { Boxes, Blocks, Sparkles, Network } from 'lucide-react';

/**
 * CommandItem — 命令面板中单条命令的定义
 */
export interface CommandItem {
  /** Unique command identifier (e.g. "/mode multi"). 命令唯一标识,如 "/mode multi" */
  id: string;
  /** User-facing label. 用户可见的命令名称 */
  label: string;
  /** Short description shown below the label. 显示在名称下方的简短说明 */
  description: string;
  /** Lucide icon component. 图标组件(来自 lucide-react) */
  icon: typeof Boxes;
  /** Category shortcut badge shown on the right. 右侧显示的分类快捷标记(如 "mode") */
  shortcut?: string;
  /** Highlight color for selected state. 选中状态的高亮颜色(十六进制) */
  color: string;
}

/**
 * MODE_COLORS — 各模式对应的高亮颜色映射
 * 用于在 UI 中区分不同模式,与 CommandItem.color 保持一致
 */
export const MODE_COLORS: Record<string, string> = {
  // 多智能体模式:靛蓝色
  multi: '#6366F1',
  // 计划模式:蓝色
  plan: '#3B82F6',
  // 执行模式:绿色
  exec: '#10B981',
  // 技能模式:琥珀色
  skills: '#F59E0B',
  // MCP 模式:紫色
  mcp: '#8B5CF6',
};

/**
 * MODE_LABELS — 各模式的显示名称映射
 * 用于 header 和模式徽章展示
 */
export const MODE_LABELS: Record<string, string> = {
  multi: 'Multi-agent',
  plan: 'Plan Mode',
  exec: 'Execute Mode',
  skills: 'Skills Mode',
  mcp: 'MCP Mode',
};

/**
 * Available slash commands (4 mode options, Execute Mode is default when nothing selected).
 * 可用的斜杠命令列表(2 种模式选项,未选择时默认为执行模式)
 * 注意:执行模式(exec)无需显式命令,当 modes 数组为空时自动启用
 */
export const COMMANDS: CommandItem[] = [
  {
    // 多智能体协作模式
    id: '/mode multi',
    label: 'Multi-agent',
    description: '多智能体协作:协调者 + 研究员 + 编码者 + 审阅者',
    icon: Boxes,
    shortcut: 'mode',
    color: '#6366F1',
  },
  {
    // 计划模式:先分解任务再逐步执行
    id: '/mode plan',
    label: 'Plan Mode',
    description: '计划模式:任务分解与逐步执行',
    icon: Blocks,
    shortcut: 'mode',
    color: '#3B82F6',
  },
  {
    // 技能模式:选择专用技能(代码审查/摘要/搜索)
    id: '/mode skills',
    label: 'Skills Mode',
    description: '技能模式:选择专用技能(代码审查/摘要/搜索)',
    icon: Sparkles,
    shortcut: 'mode',
    color: '#F59E0B',
  },
  {
    // MCP 模式:连接外部 MCP 服务器,使用其工具
    id: '/mode mcp',
    label: 'MCP Mode',
    description: 'MCP 模式:连接外部 MCP 服务器,使用其工具',
    icon: Network,
    shortcut: 'mode',
    color: '#8B5CF6',
  },
];
