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

  // 步骤列表为空时,显示 "正在规划..." 占位
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 text-[11px] text-[#999] py-3 bg-gradient-to-r from-transparent via-[#F0F1F5] to-transparent rounded-lg">
        <span className="streaming-cursor">正在规划任务步骤...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
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
          <div key={j} className="group/step">
            {/* 步骤标题行:点击可切换展开/折叠 */}
            <div
              className={
                'flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all ' +
                (isActive
                  ? 'bg-gradient-to-r from-white to-[#F8F9FC] shadow-sm'
                  : 'hover:bg-[#F8F9FC] hover:shadow-xs')
              }
              onClick={() => {
                // 标记用户已手动切换
                userToggledRef.current = isExpanded;
                // 切换展开状态:已展开则收起,未展开则展开
                setExpandedIdx(isExpanded ? null : j);
              }}
            >
              {/* 步骤状态指示器 */}
              <div className="flex-shrink-0 relative">
                {isDone ? (
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-xs">
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-xs animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-[#D4D6DD] flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-[#D4D6DD]" />
                  </div>
                )}
              </div>
              {/* 步骤描述:执行中加粗,完成时灰色,待执行时更浅的灰色 */}
              <span
                className={
                  'text-[11px] flex-1 truncate transition-colors ' +
                  (isActive
                    ? 'text-[#1A1A2E] font-semibold'
                    : isDone
                      ? 'text-[#666] font-medium'
                      : 'text-[#999]')
                }
              >
                {compact ? j + 1 + '. ' + step.step : j + 1 + '. ' + step.step}
              </span>
              {/* 完成时显示绿色 ✓ */}
              {isDone && (
                <span className="text-[#10B981] text-[10px] font-bold flex-shrink-0 bg-[#10B98118] px-1.5 py-0.5 rounded-full">
                  ✓
                </span>
              )}
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
                className="ml-4 pl-3 border-l-2 text-[11px] text-[#666] leading-relaxed max-h-32 overflow-y-auto mt-1 mb-1 markdown-body bg-gradient-to-r from-[#F8F9FC] to-transparent rounded-r-lg pr-2"
                style={{ borderColor }}
              >
                {/* 有详情时用 Markdown 渲染,否则显示 "Thinking..." 流式光标 */}
                {step.detail ? (
                  <ReactMarkdown>{step.detail}</ReactMarkdown>
                ) : (
                  <span className="streaming-cursor text-[#999]">正在分析...</span>
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
