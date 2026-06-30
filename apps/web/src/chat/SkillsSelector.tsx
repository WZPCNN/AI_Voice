// SkillsSelector — 技能选择器组件
// 当 skills 模式激活时显示,从后端获取内置技能列表供用户选择
import { memo, useState, useEffect } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useUIStore } from '../store/uiStore';
import type { SkillInfo } from '@ai-voice/shared';

function SkillsSelector() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [open, setOpen] = useState(false);
  const selectedSkill = useUIStore((s) => s.selectedSkill);
  const setSelectedSkill = useUIStore((s) => s.setSelectedSkill);

  useEffect(() => {
    api.skills
      .list()
      .then(setSkills)
      .catch(() => {});
  }, []);

  const selected = skills.find((s) => s.id === selectedSkill);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#F59E0B] bg-[#F59E0B18] px-2.5 py-1 text-[11px] font-medium text-[#F59E0B] hover:bg-[#F59E0B25] transition-colors"
      >
        <Sparkles size={12} />
        {selected ? selected.name : '选择技能'}
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-lg border border-[#EBECF0] bg-white py-1 shadow-lg">
            {skills.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSkill(s.id);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[#F5F6FA] transition-colors"
              >
                <span
                  className="mt-0.5 h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[#1A1A2E]">{s.name}</div>
                  <div className="text-[10px] text-[#999] truncate">{s.description}</div>
                </div>
                {s.id === selectedSkill && (
                  <span className="ml-auto text-[10px] text-[#F59E0B]">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(SkillsSelector);
