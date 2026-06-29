// chatStore — 聊天核心状态管理
// 管理消息列表、计划步骤、Agent 状态、流式回复
// processChunk 是核心:处理 SSE 流式数据块,更新对应 UI 状态
import { create } from 'zustand';
import type { Message, PlanStep, AgentInfo, ChatChunk } from '@agent-platform/shared';

interface ChatState {
  messages: Message[];
  sessionId: string | null;
  streaming: boolean;
  planSteps: PlanStep[];
  agentPlans: Record<string, PlanStep[]>;
  planMessageIdx: number;
  activeAgents: AgentInfo[];
  sendError: string | null;
  collapseAgents: boolean;

  // Actions
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
  setSessionId: (id: string | null) => void;
  setStreaming: (s: boolean) => void;
  setSendError: (e: string | null) => void;
  setPlanMessageIdx: (i: number) => void;
  setCollapseAgents: (c: boolean) => void;
  setActiveAgents: (updater: AgentInfo[] | ((prev: AgentInfo[]) => AgentInfo[])) => void;
  resetStreamState: () => void;
  addAssistantPlaceholder: () => void;
  processChunk: (chunk: ChatChunk) => void;
  clearMessages: () => void;
  loadMessages: (msgs: Message[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessionId: null,
  streaming: false,
  planSteps: [],
  agentPlans: {},
  planMessageIdx: -1,
  activeAgents: [],
  sendError: null,
  collapseAgents: false,

  setMessages: (updater) =>
    set((state) => ({
      messages:
        typeof updater === 'function'
          ? (updater as (p: Message[]) => Message[])(state.messages)
          : updater,
    })),

  setSessionId: (id) => set({ sessionId: id }),
  setStreaming: (s) => set({ streaming: s }),
  setSendError: (e) => set({ sendError: e }),
  setPlanMessageIdx: (i) => set({ planMessageIdx: i }),
  setCollapseAgents: (c) => set({ collapseAgents: c }),

  setActiveAgents: (updater) =>
    set((state) => ({
      activeAgents:
        typeof updater === 'function'
          ? (updater as (p: AgentInfo[]) => AgentInfo[])(state.activeAgents)
          : updater,
    })),

  resetStreamState: () =>
    set({
      streaming: true,
      planSteps: [],
      agentPlans: {},
      activeAgents: [],
      sendError: null,
      planMessageIdx: -1,
      collapseAgents: false,
    }),

  addAssistantPlaceholder: () =>
    set((state) => {
      const next = [...state.messages, { role: 'assistant' as const, content: '' }];
      return { messages: next, planMessageIdx: next.length - 1 };
    }),

  processChunk: (chunk) => {
    const state = get();

    // Agent 开始:加入 activeAgents 列表(去重)
    if (chunk.type === 'agent_start' && chunk.agent) {
      set({
        activeAgents: state.activeAgents.find((a) => a.agent === chunk.agent)
          ? state.activeAgents
          : [
              ...state.activeAgents,
              {
                agent: chunk.agent,
                name: chunk.name ?? chunk.agent,
                color: chunk.color ?? '#6366F1',
              },
            ],
      });
      return;
    }

    // Agent 结束:从 activeAgents 移除
    if (chunk.type === 'agent_end' && chunk.agent) {
      set({ activeAgents: state.activeAgents.filter((a) => a.agent !== chunk.agent) });
      return;
    }

    // 计划事件:初始化步骤列表
    if (chunk.type === 'plan' && chunk.steps) {
      const ps: PlanStep[] = chunk.steps.map((s) => ({
        step: s.step,
        assignee: s.assignee,
        status: 'pending' as const,
      }));
      if (chunk.agent) {
        set({ agentPlans: { ...state.agentPlans, [chunk.agent]: ps } });
      } else {
        set({ planSteps: ps });
        const agentNames = [...new Set(ps.filter((s) => s.assignee).map((s) => s.assignee!))];
        if (agentNames.length > 0) {
          const next = { ...state.agentPlans };
          for (const a of agentNames) if (!next[a]) next[a] = [];
          set({ agentPlans: next });
        }
      }
      return;
    }

    // 步骤开始:标记为 in_progress
    if (chunk.type === 'step_start' && chunk.index !== undefined) {
      if (chunk.agent) {
        const ag = { ...state.agentPlans };
        if (ag[chunk.agent]) {
          ag[chunk.agent] = ag[chunk.agent].map((s, i) =>
            i === chunk.index ? { ...s, status: 'in_progress', detail: '' } : s,
          );
        }
        set({ agentPlans: ag });
      }
      set({
        planSteps: state.planSteps.map((s, i) =>
          i === chunk.index ? { ...s, status: 'in_progress', detail: '' } : s,
        ),
      });
      return;
    }

    // 步骤完成:标记为 completed
    if (chunk.type === 'step_complete' && chunk.index !== undefined) {
      if (chunk.agent) {
        const ag = { ...state.agentPlans };
        if (ag[chunk.agent]) {
          ag[chunk.agent] = ag[chunk.agent].map((s, i) =>
            i === chunk.index ? { ...s, status: 'completed' } : s,
          );
        }
        set({ agentPlans: ag });
      }
      set({
        planSteps: state.planSteps.map((s, i) =>
          i === chunk.index ? { ...s, status: 'completed' } : s,
        ),
      });
      return;
    }

    // Token 事件:增量更新文本内容
    if (chunk.type === 'token' && chunk.content) {
      const inPlan =
        state.planSteps.length > 0 && state.planSteps.some((s) => s.status === 'in_progress');
      if (!inPlan) {
        // 非计划阶段:追加到最后一条 assistant 消息
        set({
          messages: state.messages.map((msg, i) => {
            if (i !== state.messages.length - 1) return msg;
            const nc = chunk.content!;
            let content = msg.content;
            if (nc.startsWith(content)) content = nc;
            else if (!content.endsWith(nc)) content += nc;
            return { ...msg, content, agent: chunk.agent ?? msg.agent };
          }),
        });
      }
      // 计划阶段:token 是步骤详情
      if (chunk.agent) {
        const ag = { ...state.agentPlans };
        if (ag[chunk.agent]) {
          const idx = ag[chunk.agent].findIndex((s) => s.status === 'in_progress');
          if (idx >= 0) {
            const cur = ag[chunk.agent][idx].detail ?? '';
            const nc = chunk.content!;
            ag[chunk.agent] = ag[chunk.agent].map((s, i) =>
              i === idx
                ? { ...s, detail: nc.startsWith(cur) ? nc : cur.endsWith(nc) ? cur : cur + nc }
                : s,
            );
          }
        }
        set({ agentPlans: ag });
      } else {
        const idx = state.planSteps.findIndex((s) => s.status === 'in_progress');
        if (idx >= 0) {
          const cur = state.planSteps[idx].detail ?? '';
          const nc = chunk.content!;
          set({
            planSteps: state.planSteps.map((s, i) =>
              i === idx
                ? { ...s, detail: nc.startsWith(cur) ? nc : cur.endsWith(nc) ? cur : cur + nc }
                : s,
            ),
          });
        }
      }
      return;
    }

    // 工具调用开始
    if (chunk.type === 'tool_start') {
      set({
        messages: state.messages.map((msg, i) =>
          i === state.messages.length - 1 ? { ...msg, toolCall: { tool: chunk.tool! } } : msg,
        ),
      });
      return;
    }

    // 工具调用结束
    if (chunk.type === 'tool_end') {
      set({
        messages: state.messages.map((msg, i) => {
          if (i !== state.messages.length - 1 || !msg.toolCall) return msg;
          return { ...msg, toolCall: { ...msg.toolCall, output: chunk.output } };
        }),
      });
      return;
    }
  },

  clearMessages: () =>
    set({ messages: [], planSteps: [], agentPlans: {}, activeAgents: [], planMessageIdx: -1 }),
  loadMessages: (msgs) => set({ messages: msgs }),
}));
