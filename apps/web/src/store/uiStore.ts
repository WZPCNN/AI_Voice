// uiStore — UI 交互状态管理
// 管理工作模式、斜杠命令面板、图片上传、Agent 折叠状态
import { create } from 'zustand';
import type { AppMode } from '@agent-platform/shared';

interface UIState {
  modes: AppMode[];
  slashQuery: string;
  slashVisible: boolean;
  selectedIdx: number;
  collapseAgents: boolean;
  images: string[];
  selectedSkill: string | null;

  setModes: (modes: AppMode[]) => void;
  toggleMode: (mode: AppMode) => void;
  setSlashQuery: (q: string) => void;
  setSlashVisible: (v: boolean) => void;
  setSelectedIdx: (i: number) => void;
  setCollapseAgents: (c: boolean) => void;
  setSelectedSkill: (s: string | null) => void;
  addImage: (img: string) => void;
  removeImage: (i: number) => void;
  clearImages: () => void;
  resetSlash: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  modes: [],
  slashQuery: '',
  slashVisible: false,
  selectedIdx: 0,
  collapseAgents: false,
  images: [],
  selectedSkill: null,

  setModes: (modes) => set({ modes }),
  toggleMode: (mode) =>
    set((state) => ({
      modes: state.modes.includes(mode)
        ? state.modes.filter((m) => m !== mode)
        : [...state.modes, mode],
    })),
  setSlashQuery: (q) => set({ slashQuery: q }),
  setSlashVisible: (v) => set({ slashVisible: v }),
  setSelectedIdx: (i) => set({ selectedIdx: i }),
  setCollapseAgents: (c) => set({ collapseAgents: c }),
  setSelectedSkill: (s) => set({ selectedSkill: s }),
  addImage: (img) => set((state) => ({ images: [...state.images, img] })),
  removeImage: (i) => set((state) => ({ images: state.images.filter((_, j) => j !== i) })),
  clearImages: () => set({ images: [] }),
  resetSlash: () => set({ slashQuery: '', slashVisible: false, selectedIdx: 0 }),
}));
