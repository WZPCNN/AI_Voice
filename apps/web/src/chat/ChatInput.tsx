// ChatInput — 聊天输入区组件
// 封装 Tiptap 编辑器、图片上传、模式徽章、模型选择、斜杠命令面板、发送/停止按钮
// 自包含设计:直接从 uiStore/chatStore 读取状态,减少 props 传递
import { memo, useRef } from 'react';
import { Send, Square, ImageIcon, X } from 'lucide-react';
import { EditorContent, type Editor } from '@tiptap/react';
import { useSlashCommands } from '../hooks/useSlashCommands';
import { useUIStore } from '../store/uiStore';
import { useChatStore } from '../store/chatStore';
import { MODE_COLORS, MODE_LABELS } from '../components/slashCommands';
import SlashCommandPalette from './SlashCommandPalette';
import ModelSelector from './ModelSelector';
import SkillsSelector from './SkillsSelector';
import McpServersPanel from './McpServersPanel';

interface ChatInputProps {
  editor: Editor | null;
  onSend: () => void;
  onStop: () => void;
  onNavigateSettings: () => void;
}

function ChatInput({ editor, onSend, onStop, onNavigateSettings }: ChatInputProps) {
  const { filteredCmds, slashVisible, slashQuery, selectedIdx, executeCommand } =
    useSlashCommands();

  const images = useUIStore((s) => s.images);
  const modes = useUIStore((s) => s.modes);
  const setModes = useUIStore((s) => s.setModes);
  const addImage = useUIStore((s) => s.addImage);
  const removeImage = useUIStore((s) => s.removeImage);
  const setSelectedIdx = useUIStore((s) => s.setSelectedIdx);

  const streaming = useChatStore((s) => s.streaming);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      const r = new FileReader();
      r.onload = () => addImage(r.result as string);
      r.readAsDataURL(f);
    }
    e.target.value = '';
  };

  return (
    <footer className="border-t border-[#EBECF0] bg-[#FFFFFF] px-6 pt-4 pb-5">
      <div className="relative max-w-[81rem] mx-auto">
        {slashVisible && filteredCmds.length > 0 && (
          <SlashCommandPalette
            query={slashQuery}
            cmds={filteredCmds}
            selectedIdx={selectedIdx}
            onSelectIdx={setSelectedIdx}
            onExecute={executeCommand}
            modes={modes}
          />
        )}
        <div
          className="flex flex-col rounded-2xl border-2 bg-white transition-all"
          style={{
            borderColor: slashVisible ? '#6366F1' : '#D4D6DD',
            boxShadow: slashVisible
              ? '0 0 0 3px rgba(99,102,241,0.1)'
              : '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          {images.length > 0 && (
            <div className="flex gap-2 px-5 pt-3 pb-1">
              {images.map((img, i) => (
                <div key={i} className="relative group flex-shrink-0">
                  <img
                    src={img}
                    className="h-12 w-12 rounded-lg border border-[#EBECF0] object-cover"
                    alt=""
                  />
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-[#EF4444] p-0.5 text-white shadow hidden group-hover:block"
                    onClick={() => removeImage(i)}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <div
            className="overflow-y-auto px-5 pt-3 flex-shrink-0"
            style={{ height: '112px', minHeight: 0 }}
          >
            {modes.length > 0 && (
              <div className="mb-1.5 flex gap-1 flex-wrap items-center">
                {modes.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                    style={{
                      backgroundColor: (MODE_COLORS[m] ?? '#6366F1') + '18',
                      color: MODE_COLORS[m] ?? '#6366F1',
                    }}
                    onClick={() => setModes(modes.filter((x) => x !== m))}
                    title="点击移除"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: MODE_COLORS[m] ?? '#6366F1' }}
                    />{' '}
                    {MODE_LABELS[m] ?? m} <X size={10} className="ml-0.5 opacity-50" />
                  </span>
                ))}
                {modes.includes('skills') && <SkillsSelector />}
                {modes.includes('mcp') && (
                  <McpServersPanel onNavigateSettings={onNavigateSettings} />
                )}
              </div>
            )}
            <EditorContent editor={editor} />
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#F0F1F5]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-lg p-2 text-[#999] hover:bg-[#F5F6FA] hover:text-[#1A1A2E] transition-colors"
                onClick={() => fileRef.current?.click()}
                title="上传图片"
              >
                <ImageIcon size={16} />
              </button>
              <ModelSelector onAddModel={onNavigateSettings} />
            </div>
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white px-4 py-1.5 text-[12px] font-medium flex items-center gap-1.5 transition-colors"
              >
                <Square size={13} /> 停止
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                className="rounded-lg bg-[#6366F1] hover:bg-[#5558E6] text-white px-4 py-1.5 text-[12px] font-medium flex items-center gap-1.5 transition-colors"
              >
                <Send size={13} /> 发送
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(ChatInput);
