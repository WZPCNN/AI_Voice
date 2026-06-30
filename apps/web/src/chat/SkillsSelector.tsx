// SkillsSelector — 技能选择器组件
// 当 skills 模式激活时显示,从后端获取内置技能列表供用户选择
import { memo, useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useUIStore } from '../store/uiStore';
import type { SkillInfo } from '@ai-voice/shared';

function SkillsSelector() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const selectedSkill = useUIStore((s) => s.selectedSkill);
  const setSelectedSkill = useUIStore((s) => s.setSelectedSkill);

  useEffect(() => {
    api.skills
      .list()
      .then(setSkills)
      .catch(() => {});
  }, []);

  const selected = skills.find((s) => s.id === selectedSkill);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.left });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#F59E0B] bg-[#F59E0B18] px-2.5 py-1 text-[11px] font-medium text-[#F59E0B] hover:bg-[#F59E0B25] transition-colors"
        title="选择要使用的技能"
      >
        <Sparkles size={12} />
        {selected ? selected.name : '选择技能'}
        <ChevronDown
          size={10}
          className="opacity-60 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-64 rounded-xl bg-white"
            style={{
              bottom: `calc(100vh - ${pos.top}px + 4px)`,
              left: pos.left,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {skills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSkill(s.id);
                    setOpen(false);
                  }}
                  className={
                    'flex w-full items-start gap-2 px-4 py-2 text-left transition-colors ' +
                    (s.id === selectedSkill
                      ? 'bg-[#FEF3C7] text-[#F59E0B]'
                      : 'text-[#666] hover:bg-[#F5F6FA]')
                  }
                >
                  <span
                    className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium">{s.name}</div>
                    <div className="text-[10px] opacity-70 truncate">{s.description}</div>
                  </div>
                  {s.id === selectedSkill && <span className="text-[10px] font-medium">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(SkillsSelector);
