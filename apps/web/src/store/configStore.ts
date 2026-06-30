// configStore — 模型配置状态管理
// 管理从后端加载的模型配置列表、当前选中配置、下拉框开关
import { create } from 'zustand';
import { api } from '../lib/api';
import type { ModelConfig } from '@ai-voice/shared';

const LS_SELECTED_CONFIG = 'agent_platform_selected_config';

interface ConfigState {
  configs: ModelConfig[];
  selectedConfigId: string | null;
  configDropdownOpen: boolean;
  loadConfigs: () => Promise<void>;
  selectConfig: (id: string) => Promise<void>;
  setConfigDropdownOpen: (open: boolean) => void;
  setSelectedConfigId: (id: string | null) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  configs: [],
  selectedConfigId: localStorage.getItem(LS_SELECTED_CONFIG),
  configDropdownOpen: false,

  loadConfigs: async () => {
    try {
      const raw = await api.configs.list();
      const items: ModelConfig[] = raw;
      set({ configs: items });
      // 仅当本地未保存选中配置时,自动选择后端标记为 isSelected 的配置
      if (!localStorage.getItem(LS_SELECTED_CONFIG)) {
        const selected = items.find((c) => c.isSelected);
        if (selected) {
          localStorage.setItem(LS_SELECTED_CONFIG, selected.id);
          set({ selectedConfigId: selected.id });
        }
      }
    } catch {
      /* ignore */
    }
  },

  selectConfig: async (id) => {
    try {
      await api.configs.select(id);
      localStorage.setItem(LS_SELECTED_CONFIG, id);
      set({ selectedConfigId: id, configDropdownOpen: false });
      await get().loadConfigs();
    } catch {
      /* ignore */
    }
  },

  setConfigDropdownOpen: (open) => set({ configDropdownOpen: open }),
  setSelectedConfigId: (id) => {
    if (id) localStorage.setItem(LS_SELECTED_CONFIG, id);
    else localStorage.removeItem(LS_SELECTED_CONFIG);
    set({ selectedConfigId: id });
  },
}));
