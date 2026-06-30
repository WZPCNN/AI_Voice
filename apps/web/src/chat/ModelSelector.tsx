// ModelSelector — 模型配置下拉选择组件
// 从 configStore 读取配置列表,支持选择和跳转添加
import { memo, useEffect, useRef } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import type { ModelConfig } from '@ai-voice/shared';

interface ModelSelectorProps {
  onAddModel: () => void;
  onOpen?: () => void;
}

function ModelSelector({ onAddModel, onOpen }: ModelSelectorProps) {
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

  const handleToggle = () => {
    if (!configDropdownOpen && onOpen) {
      onOpen();
    }
    setConfigDropdownOpen(!configDropdownOpen);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[#999] hover:bg-[#F5F6FA] hover:text-[#1A1A2E] transition-colors max-w-[180px]"
        onClick={handleToggle}
        title="选择模型"
      >
        <span className="text-[12px] text-[#1A1A2E] truncate">
          {selectedConfig
            ? selectedConfig.modelProvider + '/' + selectedConfig.modelName
            : '未选择模型'}
        </span>
        <ChevronDown
          size={12}
          className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: configDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {configDropdownOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-white z-50"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {configs.length === 0 && (
              <div className="flex flex-col items-center py-6 px-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F0F1F5] to-[#E8E8EC] flex items-center justify-center mb-2">
                  <svg
                    className="w-5 h-5 text-[#999]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <p className="text-[12px] text-[#999] text-center">暂无模型配置</p>
                <p className="text-[11px] text-[#BBB] text-center mt-1">
                  点击下方按钮添加您的第一个模型
                </p>
              </div>
            )}
            {configs.map((c) => (
              <button
                key={c.id}
                type="button"
                className={
                  'flex w-full items-start gap-2 px-4 py-2 text-left transition-colors ' +
                  (c.id === selectedConfigId
                    ? 'bg-[#EEF2FF] text-[#6366F1]'
                    : 'text-[#666] hover:bg-[#F5F6FA]')
                }
                onClick={() => {
                  setSelectedConfigId(c.id);
                  setConfigDropdownOpen(false);
                }}
              >
                <span
                  className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      c.modelProvider === 'openai'
                        ? '#10A37F'
                        : c.modelProvider === 'anthropic'
                          ? '#D4A574'
                          : c.modelProvider === 'ollama'
                            ? '#FF6B35'
                            : '#6366F1',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium">{c.modelProvider}</div>
                  <div className="text-[10px] opacity-70 truncate">{c.modelName}</div>
                </div>
                {c.isSelected && <span className="text-[10px] font-medium">✓</span>}
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
