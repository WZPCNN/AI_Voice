// useSlashCommands — 斜杠命令 Hook
// 封装命令过滤、键盘导航(ArrowUp/Down/Enter/Escape)、执行
// 从 uiStore 读取 slashQuery/slashVisible/selectedIdx/modes
import { useMemo } from 'react';
import { useUIStore } from '../store/uiStore';
import { COMMANDS, type CommandItem } from '../components/slashCommands';
import type { AppMode } from '@ai-voice/shared';

/** 命令 ID 到模式的映射 */
const CMD_MODE_MAP: Record<string, AppMode> = {
  '/mode multi': 'multi',
  '/mode plan': 'plan',
  '/mode skills': 'skills',
  '/mode mcp': 'mcp',
};

export function useSlashCommands() {
  const slashQuery = useUIStore((s) => s.slashQuery);
  const slashVisible = useUIStore((s) => s.slashVisible);
  const selectedIdx = useUIStore((s) => s.selectedIdx);
  const toggleMode = useUIStore((s) => s.toggleMode);
  const setSlashVisible = useUIStore((s) => s.setSlashVisible);
  const setSelectedIdx = useUIStore((s) => s.setSelectedIdx);
  const resetSlash = useUIStore((s) => s.resetSlash);

  // 根据查询过滤命令
  const filteredCmds = useMemo(() => {
    const q = slashQuery.toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        (c.shortcut && c.shortcut.includes(q.replace('/', ''))),
    );
  }, [slashQuery]);

  /** executeCommand — 执行选中的命令(切换对应模式) */
  const executeCommand = (cmd: CommandItem) => {
    const targetMode = CMD_MODE_MAP[cmd.id];
    if (targetMode) toggleMode(targetMode);
    resetSlash();
  };

  /**
   * handleKeyDown — 键盘事件处理(命令面板显示时拦截)
   * @returns true 表示已拦截,调用方应阻止默认行为
   */
  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (!slashVisible || filteredCmds.length === 0) return false;
    if (event.key === 'Enter') {
      event.preventDefault();
      executeCommand(filteredCmds[Math.min(selectedIdx, filteredCmds.length - 1)]);
      return true;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIdx((selectedIdx + 1) % filteredCmds.length);
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIdx((selectedIdx - 1 + filteredCmds.length) % filteredCmds.length);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashVisible(false);
      return true;
    }
    return false;
  };

  return { filteredCmds, executeCommand, handleKeyDown, slashVisible, slashQuery, selectedIdx };
}
