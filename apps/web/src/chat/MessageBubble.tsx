// MessageBubble — 单条消息气泡组件
// 渲染 user/assistant 消息,含 Agent 标记、图片、PlanSection、Markdown、工具调用、中断重试、复制
import { memo, useMemo } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PlanSection from './PlanSection';
import type { Message, PlanStep } from '@ai-voice/shared';

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
    if (hasAgents) return `${agentNames.length} 个智能体正在协作处理您的请求`;
    if (hasPlan) return '正在按计划执行任务';
    return '正在思考您的问题';
  }, [hasAgents, hasPlan, agentNames.length]);

  // 计划是否全部完成(用于决定是否渲染最终回复)
  const planAllDone = planSteps.every((s) => s.status === 'completed' || s.status === 'failed');

  // 缓存 Markdown 渲染(避免每次重渲染都重新解析)
  const contentNode = useMemo(() => {
    if (!msg.content) return null;
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>;
  }, [msg.content]);

  return (
    <div className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={
          'max-w-[72%] rounded-2xl px-4 py-3 transition-all ' +
          (isUser
            ? 'bg-gradient-to-br from-[#6366F1] to-[#5558E6] text-white rounded-br-md shadow-md'
            : 'bg-white text-[#1A1A2E] rounded-bl-md border border-[#E8E8EC] shadow-sm')
        }
        style={{
          boxShadow: isUser ? '0 4px 12px rgba(99,102,241,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        {/* Agent 来源标记 */}
        {msg.agent && (
          <div
            className="mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
            style={{
              borderColor: '#6366F140',
              color: '#6366F1',
              backgroundColor: '#6366F115',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: '#6366F1' }}
            />
            {msg.agent}
          </div>
        )}
        {/* 图片附件 */}
        {msg.images &&
          msg.images.map((img, j) => (
            <img
              key={j}
              src={img}
              className="mb-2 max-h-44 rounded-xl border-2 border-[#EBECF0] shadow-sm"
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
              <span className="streaming-cursor text-[13px]">正在思考您的问题...</span>
            ) : null}
          </div>
        ) : planAllDone && msg.content ? (
          <div className="mt-3 pt-3 border-t border-[#E8E8EC] text-[13px] leading-relaxed markdown-body">
            {contentNode}
          </div>
        ) : null}
        {/* 中断标记 + 重试 */}
        {msg.interrupted && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-3 py-2">
            <div className="flex items-center gap-1.5 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
              <p className="text-[11px] text-[#DC2626] font-medium">
                {msg.interruptReason === 'user' ? '用户强制中断' : '模型连接异常，请稍后重试'}
              </p>
            </div>
            <button
              onClick={onRetry}
              className="flex items-center gap-1 rounded-md bg-white border border-[#EF4444] px-2 py-1 text-[11px] text-[#EF4444] hover:bg-[#EF4444] hover:text-white transition-all"
              title="重新生成完整回复"
            >
              <RefreshCw size={11} />
              重新生成
            </button>
          </div>
        )}
        {/* 复制按钮:仅 assistant 消息且有内容 */}
        {!isUser && msg.content && (
          <div className="mt-2 flex justify-end gap-1">
            <button
              onClick={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
              className="rounded-lg p-1.5 text-[#999] hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-all"
              title="复制回复内容"
            >
              <Copy size={13} />
            </button>
          </div>
        )}
        {/* 工具调用 */}
        {msg.toolCall && (
          <div className="mt-2 rounded-xl border-2 border-[#EBECF0] bg-[#F8F9FC] px-3 py-2 text-[11px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              <span className="font-mono font-semibold text-[#6366F1]">{msg.toolCall.tool}</span>
            </div>
            {msg.toolCall.output ? (
              <div className="mt-1 text-[#666] break-all max-h-16 overflow-y-auto leading-relaxed">
                {msg.toolCall.output.length > 100
                  ? msg.toolCall.output.slice(0, 100) + '...'
                  : msg.toolCall.output}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1 ml-1">
                <div className="flex gap-0.5">
                  <span
                    className="w-1 h-1 rounded-full bg-[#6366F1] animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-1 h-1 rounded-full bg-[#6366F1] animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-1 h-1 rounded-full bg-[#6366F1] animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-[#6366F1]">正在调用工具...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
