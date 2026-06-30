/** PlanTemplate — reusable vertical plan steps with independent expand state.
 *  PlanTemplate — 可复用的垂直计划步骤组件,每个步骤有独立的展开/折叠状态
 *  被两处复用:PlanSection(单计划)和 AgentCard(多智能体卡片内)
 */
// 从 react 导入 useState、useEffect、useRef 三个 Hook
// useState — 状态管理(当前展开的步骤索引)
// useEffect — 副作用(响应 collapseAgents 变化)
// useRef — 跨渲染保持可变值(无需触发重渲染)
import { useState, useEffect, useRef, memo } from 'react';
// 导入 ReactMarkdown — 将 Markdown 文本渲染为 HTML
import ReactMarkdown from 'react-markdown';
// 导入 PlanStep 类型
import type { PlanStep } from '@ai-voice/shared';

/**
 * PlanTemplateProps — PlanTemplate 组件的 props 类型
 */
interface PlanTemplateProps {
  // 步骤列表
  steps: PlanStep[];
  // 主题色(可选,用于 Agent 卡片模式)
  color?: string;
  // 紧凑模式(可选):true 时用于 Agent 卡片,字号更小
  compact?: boolean;
  // 是否折叠所有子步骤详情
  collapseAgents?: boolean;
}

/**
 * PlanTemplate — 计划步骤模板组件
 */
function PlanTemplate({ steps, color, compact, collapseAgents }: PlanTemplateProps) {
  // 当前展开的步骤索引(null 表示无展开)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  // 最后一个处于 in_progress 状态的步骤索引(用于自动展开逻辑)
  const lastActiveRef = useRef<number | null>(null);
  // 用户是否手动切换过展开状态(用于禁用自动展开)
  const userToggledRef = useRef(false);

  // Track the last step that was "in_progress"
  // 在每次渲染时查找当前 in_progress 的步骤,记录到 ref
  // 注意:渲染期间修改 ref 是安全的,因为不触发重渲染
  const activeIdx = steps.findIndex((s) => s.status === 'in_progress');
  if (activeIdx >= 0) lastActiveRef.current = activeIdx;

  // Collapse when signaled
  // 当 collapseAgents 变为 true 时,重置所有展开状态
  useEffect(() => {
    if (collapseAgents) {
      setExpandedIdx(null);
      lastActiveRef.current = null;
      userToggledRef.current = false;
    }
  }, [collapseAgents]);

  // 步骤列表为空时,显示 "Thinking..." 占位
  if (steps.length === 0) {
    return (
      <div className="text-[10px] text-[#999] text-center py-2">
        <span className="streaming-cursor">Thinking...</span>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {steps.map((step, j) => {
        // 当前步骤是否处于执行中
        const isActive = step.status === 'in_progress';
        // 当前步骤是否已完成
        const isDone = step.status === 'completed';
        // 当前步骤是否被用户展开
        const isExpanded = expandedIdx === j;
        // 详情区域左边框颜色:有主题色则用主题色 + 50 透明度,否则默认灰色
        const borderColor = color ? color + '50' : '#E8E8EC';

        return (
          <div key={j}>
            {/* 步骤标题行:点击可切换展开/折叠 */}
            <div
              className={
                'flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer ' +
                (isActive ? 'bg-white' : 'hover:bg-[#F8F9FC]')
              }
              onClick={() => {
                // 标记用户已手动切换
                userToggledRef.current = isExpanded;
                // 切换展开状态:已展开则收起,未展开则展开
                setExpandedIdx(isExpanded ? null : j);
              }}
            >
              {/* 步骤状态指示点:完成-绿色、执行中-靛蓝色+脉冲动画、待执行-灰色 */}
              <span
                className={
                  'h-1 w-1 rounded-full flex-shrink-0 ' +
                  (isDone
                    ? 'bg-[#10B981]'
                    : isActive
                      ? 'bg-[#6366F1] animate-pulse'
                      : 'bg-[#D4D6DD]')
                }
              />
              {/* 步骤描述:执行中加粗,完成时灰色,待执行时更浅的灰色 */}
              <span
                className={
                  'text-[10px] flex-1 truncate ' +
                  (isActive ? 'text-[#1A1A2E] font-medium' : isDone ? 'text-[#666]' : 'text-[#999]')
                }
              >
                {/* compact 模式和其他模式使用相同的展示(保留原始条件分支,便于后续扩展) */}
                {compact ? j + 1 + '. ' + step.step : j + 1 + '. ' + step.step}
              </span>
              {/* 完成时显示绿色 ✓ */}
              {isDone && <span className="text-[#10B981] text-[9px] flex-shrink-0">✓</span>}
            </div>
            {/* 详情区域:满足以下任一条件时显示
                1. 当前步骤执行中(isActive)
                2. 用户主动展开(isExpanded)
                3. 未折叠 + 用户未手动切换 + 当前步骤已完成 + 是最后活跃步骤(自动展开最近完成的步骤)
            */}
            {(isActive ||
              isExpanded ||
              (!collapseAgents &&
                !userToggledRef.current &&
                isDone &&
                j === lastActiveRef.current)) && (
              <div
                className="ml-2 pl-2 border-l-2 text-[10px] text-[#999] leading-relaxed max-h-32 overflow-y-auto mt-0.5 markdown-body"
                style={{ borderColor }}
              >
                {/* 有详情时用 Markdown 渲染,否则显示 "Thinking..." 流式光标 */}
                {step.detail ? (
                  <ReactMarkdown>{step.detail}</ReactMarkdown>
                ) : (
                  <span className="streaming-cursor">Thinking...</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(PlanTemplate);
