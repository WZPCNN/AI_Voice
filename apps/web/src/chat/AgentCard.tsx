/** AgentCard — reusable card for multi-agent display. Each card has its own PlanTemplate.
 *  AgentCard — 多智能体展示用的可复用卡片,每张卡片内嵌独立的 PlanTemplate
 *  在多智能体模式下,每个专家 Agent 对应一张卡片,横向滚动展示
 */
// 导入 memo — React 高阶组件,记忆化组件渲染避免不必要重渲染
import { memo } from 'react';
// 导入 PlanTemplate 子组件 — 用于渲染该 Agent 的执行步骤
import PlanTemplate from './PlanTemplate';
// 导入 PlanStep 类型 — 描述单个步骤
import type { PlanStep } from '@ai-voice/shared';

/**
 * AgentCardProps — AgentCard 组件的 props 类型
 */
interface AgentCardProps {
  // Agent 显示名称
  agentName: string;
  // 该 Agent 的步骤列表
  steps: PlanStep[];
  // 卡片主题色(用于边框、状态点等)
  color: string;
  // 是否折叠子 Agent 详情(全部完成后自动折叠)
  collapseAgents?: boolean;
}

/**
 * AgentCard — 单个 Agent 卡片组件
 */
function AgentCard({ agentName, steps, color, collapseAgents }: AgentCardProps) {
  // 统计当前正在执行的步骤数(in_progress 状态)
  const inProgress = steps.filter((s) => s.status === 'in_progress').length;
  // 判断所有步骤是否全部完成(用于显示"✓ 完成"标记)
  // steps.length > 0 防止空列表被误判为"全部完成"
  const allDone = steps.length > 0 && steps.every((s) => s.status === 'completed');

  return (
    <div
      className="flex-shrink-0 rounded-2xl border-2 bg-white overflow-hidden shadow-sm transition-all hover:shadow-md flex flex-col"
      style={{
        width: '280px',
        minWidth: '220px',
        borderColor: color + '40',
        scrollSnapAlign: 'start',
        boxShadow: `0 2px 8px ${color}15`,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b-2"
        style={{
          backgroundColor: color + '18',
          borderColor: color + '30',
        }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-opacity-30"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 0 2px ${color}30`,
            animation: inProgress > 0 ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        <span className="text-[12px] font-semibold text-[#1A1A2E] truncate flex-1">
          {agentName}
        </span>
        {inProgress > 0 && (
          <span className="text-[10px] text-[#6366F1] flex-shrink-0 font-medium flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-[#6366F1] animate-pulse" />
            处理中
          </span>
        )}
        {allDone && (
          <span
            className="text-[10px] font-semibold flex-shrink-0 rounded-full px-2 py-0.5 flex items-center gap-1"
            style={{ backgroundColor: '#10B98120', color: '#10B981' }}
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
            已完成
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 px-3 py-2.5 max-h-[200px] overflow-y-auto bg-gradient-to-b from-white to-[#F8F9FC]">
        <PlanTemplate steps={steps} color={color} compact collapseAgents={collapseAgents} />
      </div>
    </div>
  );
}

export default memo(AgentCard);
