// SlashCommandPalette — 斜杠命令面板组件
// 显示过滤后的命令列表,支持键盘导航高亮和鼠标点击
import { memo } from 'react';
import { type CommandItem } from '../components/slashCommands';
import type { AppMode } from '@ai-voice/shared';

interface SlashCommandPaletteProps {
  query: string;
  cmds: CommandItem[];
  selectedIdx: number;
  onSelectIdx: (i: number) => void;
  onExecute: (cmd: CommandItem) => void;
  modes: AppMode[];
}

function SlashCommandPalette({
  query,
  cmds,
  selectedIdx,
  onSelectIdx,
  onExecute,
  modes,
}: SlashCommandPaletteProps) {
  if (cmds.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 mb-3 w-80 rounded-2xl overflow-hidden z-50"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
    >
      <div className="flex items-center gap-2 bg-white px-4 py-3 border-b-2 border-[#6366F1]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6366F1]">
          命令
        </span>
        <span className="text-[13px] text-[#1A1A2E] font-mono">{query}</span>
      </div>
      <div className="max-h-60 overflow-y-auto bg-white py-1">
        {cmds.map((cmd, i) => {
          const modeKey =
            cmd.id === '/mode multi'
              ? 'multi'
              : cmd.id === '/mode plan'
                ? 'plan'
                : cmd.id === '/mode skills'
                  ? 'skills'
                  : cmd.id === '/mode mcp'
                    ? 'mcp'
                    : 'exec';
          const isActive = modes.includes(modeKey as AppMode);
          return (
            <button
              key={cmd.id}
              type="button"
              className={
                'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors ' +
                (i === selectedIdx ? '' : 'text-[#666] hover:bg-[#F5F6FA]')
              }
              style={
                i === selectedIdx
                  ? { backgroundColor: cmd.color + '18', color: '#1A1A2E' }
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                onExecute(cmd);
              }}
              onMouseEnter={() => onSelectIdx(i)}
            >
              <cmd.icon size={14} className="flex-shrink-0" style={{ color: cmd.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {cmd.label} {isActive && <span className="ml-1 text-[10px] opacity-60">✓</span>}
                </div>
                <div className="text-[11px] truncate opacity-60">{cmd.description}</div>
              </div>
              {cmd.shortcut && (
                <span
                  className="flex-shrink-0 rounded-md border border-[#E8E8EC] px-1.5 text-[10px] font-mono bg-[#F8F9FC]"
                  style={{ color: cmd.color }}
                >
                  {cmd.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 border-t border-[#E8E8EC] bg-[#F8F9FC] px-4 py-2 text-[10px] text-[#999]">
        <span>
          <kbd className="rounded border border-[#E8E8EC] bg-white px-1 py-0.5 text-[#666]">↑↓</kbd>{' '}
          导航
        </span>
        <span>
          <kbd className="rounded border border-[#E8E8EC] bg-white px-1 py-0.5 text-[#666]">↵</kbd>{' '}
          选择
        </span>
        <span>
          <kbd className="rounded border border-[#E8E8EC] bg-white px-1 py-0.5 text-[#666]">
            esc
          </kbd>{' '}
          关闭
        </span>
      </div>
    </div>
  );
}

export default memo(SlashCommandPalette);
