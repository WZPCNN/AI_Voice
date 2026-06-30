// ModelSelector — 模型配置下拉选择组件
// 从 configStore 读取配置列表,支持选择和跳转添加
import { memo, useEffect, useRef } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import type { ModelConfig } from '@ai-voice/shared';

interface ModelSelectorProps {
  onAddModel: () => void;
}

function ModelSelector({ onAddModel }: ModelSelectorProps) {
  const configs = useConfigStore((s) => s.configs);
  const selectedConfigId = useConfigStore((s) => s.selectedConfigId);
  const configDropdownOpen = useConfigStore((s) => s.configDropdownOpen);
  const setConfigDropdownOpen = useConfigStore((s) => s.setConfigDropdownOpen);
  const setSelectedConfigId = useConfigStore((s) => s.setSelectedConfigId);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!configDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setConfigDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [configDropdownOpen, setConfigDropdownOpen]);

  const selectedConfig: ModelConfig | undefined = configs.find((c) => c.id === selectedConfigId);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[#999] hover:bg-[#F5F6FA] hover:text-[#1A1A2E] transition-colors max-w-[180px]"
        onClick={() => setConfigDropdownOpen(!configDropdownOpen)}
        title="选择模型"
      >
        <span className="text-[12px] text-[#1A1A2E] truncate">
          {selectedConfig
            ? selectedConfig.modelProvider + '/' + selectedConfig.modelName
            : '当前暂无模型配置'}
        </span>
        <ChevronDown size={12} className="flex-shrink-0" />
      </button>
      {configDropdownOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-white z-50"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {configs.length === 0 && (
              <p className="text-[12px] text-[#999] text-center py-4">当前暂无模型配置</p>
            )}
            {configs.map((c) => (
              <button
                key={c.id}
                type="button"
                className={
                  'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors ' +
                  (c.id === selectedConfigId
                    ? 'bg-[#EEF2FF] text-[#6366F1]'
                    : 'text-[#666] hover:bg-[#F5F6FA]')
                }
                onClick={() => {
                  setSelectedConfigId(c.id);
                  setConfigDropdownOpen(false);
                }}
              >
                <span className="text-[13px] truncate flex-1">
                  {c.modelProvider}/{c.modelName}
                </span>
                {c.isSelected && (
                  <span className="text-[10px] text-[#6366F1] font-medium">✓</span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-[#E8E8EC] px-3 py-2">
            <button
              type="button"
              className="flex items-center gap-2 text-[12px] text-[#6366F1] hover:text-[#5558E6] font-medium transition-colors w-full"
              onClick={() => {
                setConfigDropdownOpen(false);
                onAddModel();
              }}
            >
              <Plus size={14} /> 添加模型
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ModelSelector);
