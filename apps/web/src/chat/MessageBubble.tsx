// MessageBubble — 单条消息气泡组件
// 渲染 user/assistant 消息,含 Agent 标记、图片、PlanSection、Markdown、工具调用、中断重试、复制
import { memo, useMemo } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import PlanSection from './PlanSection';
import type { Message, PlanStep } from '@agent-platform/shared';

interface MessageBubbleProps {
  msg: Message;
  index: number;
  isLast: boolean;
  streaming: boolean;
  planMessageIdx: number;
  planSteps: PlanStep[];
  agentPlans: Record<string, PlanStep[]>;
  collapseAgents: boolean;
  onRetry: () => void;
}

function MessageBubble({
  msg,
  index,
  isLast,
  streaming,
  planMessageIdx,
  planSteps,
  agentPlans,
  collapseAgents,
  onRetry,
}: MessageBubbleProps) {
  const isUser = msg.role === 'user';
  const isCurrentPlan = msg.role === 'assistant' && index === planMessageIdx;
  const agentNames = agentPlans ? Object.keys(agentPlans) : [];
  const hasPlan = planSteps.length > 0;
  const hasAgents = agentNames.length > 0;

  // 提示文本:多智能体协作中/正在执行计划/思考中
  const hint = useMemo(() => {
    if (hasAgents) return agentNames.length + ' 个智能体协作中...';
    if (hasPlan) return '正在执行计划...';
    return '思考中...';
  }, [hasAgents, hasAgents, agentNames.length]);

  // 计划是否全部完成(用于决定是否渲染最终回复)
  const planAllDone = planSteps.every((s) => s.status === 'completed' || s.status === 'failed');

  // 缓存 Markdown 渲染(避免每次重渲染都重新解析)
  const contentNode = useMemo(() => {
    if (!msg.content) return null;
    return <ReactMarkdown>{msg.content}</ReactMarkdown>;
  }, [msg.content]);

  return (
    <div className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={
          'max-w-[72%] rounded-2xl px-4 py-3 ' +
          (isUser
            ? 'bg-[#6366F1] text-white rounded-br-md'
            : 'bg-[#F5F6FA] text-[#1A1A2E] rounded-bl-md')
        }
      >
        {/* Agent 来源标记 */}
        {msg.agent && (
          <span
            className="mb-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium"
            style={{
              borderColor: '#6366F140',
              color: '#6366F1',
              backgroundColor: '#6366F115',
            }}
          >
            <span className="h-1 w-1 rounded-full" style={{ backgroundColor: '#6366F1' }} /> {msg.agent}
          </span>
        )}
        {/* 图片附件 */}
        {msg.images &&
          msg.images.map((img, j) => (
            <img
              key={j}
              src={img}
              className="mb-2 max-h-44 rounded-xl border border-[#EBECF0]"
              alt=""
            />
          ))}
        {/* 计划区域:仅当前 plan 消息 */}
        {isCurrentPlan && (
          <div>
            {/* 提示文本:流式中或无内容但有计划时显示 */}
            {(streaming || (!msg.content && hasPlan)) && (
              <div className="text-[11px] text-[#999] mb-2 flex items-center gap-1.5">
                <span className="streaming-cursor">{hint}</span>
              </div>
            )}
            {/* 计划插槽 */}
            {hasPlan && (
              <PlanSection
                planSteps={planSteps}
                agentPlans={agentPlans}
                collapseAgents={collapseAgents}
              />
            )}
          </div>
        )}
        {/* 内容渲染:
            - 非当前 plan 消息:直接渲染 Markdown
            - 当前 plan 消息且计划全部完成:渲染最终回复
            - 否则:不渲染内容 */}
        {planSteps.length === 0 || index !== planMessageIdx ? (
          <div className="text-[13px] leading-relaxed markdown-body">
            {msg.content ? (
              contentNode
            ) : streaming && isLast && index !== planMessageIdx ? (
              <span className="streaming-cursor text-[13px]">思考中...</span>
            ) : null}
          </div>
        ) : planAllDone && msg.content ? (
          <div className="mt-3 pt-3 border-t border-[#E8E8EC] text-[13px] leading-relaxed markdown-body">
            {contentNode}
          </div>
        ) : null}
        {/* 中断标记 + 重试 */}
        {msg.interrupted && (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-[11px] text-[#EF4444] font-medium">— 用户强制中断 —</p>
            <button
              onClick={onRetry}
              className="rounded-md p-1 text-[#999] hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors"
              title="重试"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}
        {/* 复制按钮:仅 assistant 消息且有内容 */}
        {!isUser && msg.content && (
          <div className="mt-1.5 flex justify-end gap-1">
            <button
              onClick={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
              className="rounded-md p-1 text-[#999] hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors"
              title="复制"
            >
              <Copy size={13} />
            </button>
          </div>
        )}
        {/* 工具调用 */}
        {msg.toolCall && (
          <div className="mt-1.5 rounded-xl border border-[#EBECF0] bg-white px-2.5 py-1.5 text-[11px]">
            <span className="font-mono text-[#6366F1]">{msg.toolCall.tool}</span>
            {msg.toolCall.output ? (
              <div className="mt-1 text-[#666] break-all max-h-16 overflow-y-auto">
                {msg.toolCall.output.length > 100
                  ? msg.toolCall.output.slice(0, 100) + '...'
                  : msg.toolCall.output}
              </div>
            ) : (
              <span className="text-[#999] ml-1">执行中...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
