/** PlanSection — orchestrator: decides single-plan or multi-agent layout.
 *  PlanSection — 编排组件:决定使用单计划布局还是多智能体布局
 *  根据 planSteps 和 agentPlans 的内容自动判断渲染模式
 */
// 从 lucide-react 导入 Sparkles 图标(用于标题装饰)
import { memo } from 'react';
import { Sparkles } from 'lucide-react';
// 导入 PlanTemplate 子组件 — 渲染单个计划列表
import PlanTemplate from './PlanTemplate';
// 导入 AgentCard 子组件 — 渲染单个 Agent 卡片
import AgentCard from './AgentCard';
// 导入 PlanStep 类型
import type { PlanStep } from '@ai-voice/shared';

/**
 * COLORS — 多智能体卡片的颜色循环池
 * 当 Agent 数量超过颜色数时,通过取模运算循环使用
 */
const COLORS = [
  '#6366F1',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#F97316',
];

/**
 * PlanSectionProps — PlanSection 组件的 props 类型
 */
interface PlanSectionProps {
  planSteps: PlanStep[];
  agentPlans: Record<string, PlanStep[]> | null;
  collapseAgents?: boolean;
}

/**
 * PlanSection — 计划区域组件
 * 根据数据自动切换布局:
 *   - 若存在 Agent(从 agentPlans keys 或 planSteps.assignee 检测),渲染横向 AgentCard 列表
 *   - 否则若存在 planSteps,渲染垂直 PlanTemplate
 *   - 都没有则返回 null(不渲染)
 */
function PlanSection({ planSteps, agentPlans, collapseAgents }: PlanSectionProps) {
  // Detect multi-agent from BOTH agentPlans keys AND planSteps assignees
  // 从 agentPlans 的 keys 和 planSteps 的 assignee 字段两个来源收集 Agent 名称
  const agentPlanKeys = agentPlans ? Object.keys(agentPlans) : [];
  // 提取 planSteps 中带有 assignee 的步骤的 assignee 值(! 表示断言非空)
  const planStepAgents = planSteps.filter((s) => s.assignee).map((s) => s.assignee!);
  // 合并去重:使用 Set 去重后再展开为数组
  const agentNames = [...new Set([...agentPlanKeys, ...planStepAgents])];
  // 是否为多智能体模式
  const hasAgents = agentNames.length > 0;
  // 是否有计划步骤
  const hasPlanSteps = planSteps.length > 0;

  // ── Multi-agent: horizontal AgentCards ───────────────────────────
  // 多智能体模式:渲染横向滚动的 AgentCard 列表
  if (hasAgents) {
    // Build cards from deduplicated agentNames, carrying steps from agentPlans
    // 根据 agentNames 构建卡片数据,从 agentPlans 取对应步骤
    const cards = agentNames.map((name, ai) => ({
      name,
      // 若 agentPlans 中无此 Agent 的步骤,使用空数组兜底
      steps: agentPlans?.[name] || [],
      // 颜色循环:超过 COLORS 长度时取模
      color: COLORS[ai % COLORS.length],
    }));

    return (
      <div className="mt-2 border-t border-[#E8E8EC] pt-2">
        {/* 标题行:Sparkles 图标 + "智能体协作" + Agent 数量 */}
        <div className="flex items-center gap-1 text-[10px] text-[#999] mb-2">
          <Sparkles size={11} />
          <span className="font-semibold uppercase tracking-[0.1em]">智能体协作</span>
          <span className="text-[#6366F1]">· {cards.length} 个智能体</span>
        </div>
        {/* 横向滚动容器:flex + overflow-x-auto */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cards.map((card) => (
            <AgentCard
              key={card.name}
              agentName={card.name}
              steps={card.steps}
              color={card.color}
              collapseAgents={collapseAgents}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Single-plan: vertical PlanTemplate ───────────────────────────
  // 单计划模式:渲染垂直 PlanTemplate
  if (hasPlanSteps) {
    return (
      <div className="mt-2 border-t border-[#E8E8EC] pt-2">
        <div className="flex items-center gap-1 text-[10px] text-[#999] mb-1.5">
          <Sparkles size={11} />
          <span className="font-semibold uppercase tracking-[0.1em]">执行计划</span>
        </div>
        <PlanTemplate steps={planSteps} collapseAgents={collapseAgents} />
      </div>
    );
  }

  // 既无 Agent 也无计划步骤,返回 null 不渲染
  return null;
}

export default memo(PlanSection);
