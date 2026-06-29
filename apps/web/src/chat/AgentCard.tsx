/** AgentCard — reusable card for multi-agent display. Each card has its own PlanTemplate.
 *  AgentCard — 多智能体展示用的可复用卡片,每张卡片内嵌独立的 PlanTemplate
 *  在多智能体模式下,每个专家 Agent 对应一张卡片,横向滚动展示
 */
// 导入 memo — React 高阶组件,记忆化组件渲染避免不必要重渲染
import { memo } from 'react';
// 导入 PlanTemplate 子组件 — 用于渲染该 Agent 的执行步骤
import PlanTemplate from './PlanTemplate';
// 导入 PlanStep 类型 — 描述单个步骤
import type { PlanStep } from '@agent-platform/shared';

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
    // 卡片容器:flex-shrink-0 防止被压缩,width/minWidth 固定大小
    // borderColor 使用 color + "50"(8 位十六进制,50 = 30% 透明度)
    // scrollSnapAlign: "start" — 横向滚动时吸附对齐到起点
    <div
      className="flex-shrink-0 rounded-lg border p-2 flex flex-col"
      style={{
        width: '280px',
        minWidth: '220px',
        borderColor: color + '50',
        scrollSnapAlign: 'start',
      }}
    >
      {/* Agent header. Agent 头部:状态点 + 名称 + 状态文字 */}
      <div
        className="flex items-center gap-1.5 mb-2 pb-1.5 border-b"
        style={{ borderColor: color + '30' }}
      >
        {/* 状态指示点:正在执行时使用 pulse 动画 */}
        <span
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: color,
            animation: inProgress > 0 ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        {/* Agent 名称:超长时截断 */}
        <span className="text-[11px] font-semibold text-[#1A1A2E] truncate">{agentName}</span>
        {/* 执行中:显示在右侧(ml-auto) */}
        {inProgress > 0 && <span className="text-[9px] text-[#999] ml-auto">执行中</span>}
        {/* 全部完成:显示绿色 ✓ */}
        {allDone && <span className="text-[9px] text-[#10B981] ml-auto">✓ 完成</span>}
      </div>
      {/* Agent body: independent PlanTemplate. Agent 主体:独立的 PlanTemplate */}
      <div className="flex-1 min-h-0">
        {/* compact 模式使 PlanTemplate 以紧凑样式渲染(适配卡片宽度) */}
        <PlanTemplate steps={steps} color={color} compact collapseAgents={collapseAgents} />
      </div>
    </div>
  );
}

export default memo(AgentCard);
