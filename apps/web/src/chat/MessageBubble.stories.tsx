import type { Meta, StoryObj } from '@storybook/react-vite';
import MessageBubble from './MessageBubble';
import type { Message, PlanStep } from '@ai-voice/shared';

const meta: Meta<typeof MessageBubble> = {
  title: 'Chat/MessageBubble',
  component: MessageBubble,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    index: { control: 'number' },
    isLast: { control: 'boolean' },
    streaming: { control: 'boolean' },
    planMessageIdx: { control: 'number' },
    collapseAgents: { control: 'boolean' },
  },
  render: (args) => (
    <div className="max-w-2xl mx-auto space-y-4 py-4">
      <MessageBubble {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof MessageBubble>;

const userMessage: Message = {
  role: 'user',
  content: '请帮我用 TypeScript 实现一个快速排序算法,并解释其工作原理。',
};

const assistantText: Message = {
  role: 'assistant',
  content:
    '快速排序是一种**分治算法**,平均时间复杂度为 O(n log n)。\n\n```typescript\nfunction quickSort(arr: number[]): number[] {\n  if (arr.length <= 1) return arr;\n  const pivot = arr[0];\n  const left = arr.slice(1).filter((x) => x < pivot);\n  const right = arr.slice(1).filter((x) => x >= pivot);\n  return [...quickSort(left), pivot, ...quickSort(right)];\n}\n```\n\n核心思路是选取一个 **pivot**,将数组分为小于和大于 pivot 两部分,递归排序。',
};

const planSteps: PlanStep[] = [
  {
    step: '分析需求并制定实现计划',
    assignee: 'coordinator',
    status: 'completed',
    detail: '需求明确:实现 TypeScript 快速排序,带注释与原理解释。',
  },
  {
    step: '编写 quickSort 函数实现',
    assignee: 'coder',
    status: 'in_progress',
    detail: '正在编写递归实现,处理 pivot 选取与分区逻辑。',
  },
  {
    step: '编写单元测试验证正确性',
    assignee: 'reviewer',
    status: 'pending',
  },
];

const assistantWithToolCall: Message = {
  role: 'assistant',
  content: '已执行代码搜索,找到 3 处相关实现。',
  toolCall: {
    tool: 'search_code',
    output:
      'src/sort/quick.ts:1-15\nsrc/sort/merge.ts:1-20\nsrc/utils/sort-helpers.ts:8-30\n... (共 3 处匹配)',
  },
};

const assistantInterrupted: Message = {
  role: 'assistant',
  content: '快速排序的核心思路是选取一个 pivot,然后将...',
  interrupted: true,
};

const assistantFromAgent: Message = {
  role: 'assistant',
  agent: 'coder',
  content: '已实现 quickSort 函数,使用 TypeScript 严格类型。',
};

export const UserText: Story = {
  args: {
    msg: userMessage,
    index: 0,
    isLast: false,
    streaming: false,
    planMessageIdx: -1,
    planSteps: [],
    agentPlans: {},
    collapseAgents: false,
    onRetry: () => alert('retry'),
  },
};

export const AssistantText: Story = {
  args: {
    msg: assistantText,
    index: 1,
    isLast: true,
    streaming: false,
    planMessageIdx: -1,
    planSteps: [],
    agentPlans: {},
    collapseAgents: false,
    onRetry: () => alert('retry'),
  },
};

export const AssistantStreaming: Story = {
  args: {
    msg: { ...assistantText, content: '' },
    index: 1,
    isLast: true,
    streaming: true,
    planMessageIdx: -1,
    planSteps: [],
    agentPlans: {},
    collapseAgents: false,
    onRetry: () => alert('retry'),
  },
};

export const AssistantWithPlan: Story = {
  args: {
    msg: { ...assistantText, content: '' },
    index: 1,
    isLast: true,
    streaming: true,
    planMessageIdx: 1,
    planSteps,
    agentPlans: {
      coordinator: [planSteps[0]],
      coder: [planSteps[1]],
      reviewer: [planSteps[2]],
    },
    collapseAgents: false,
    onRetry: () => alert('retry'),
  },
};

export const AssistantWithToolCall: Story = {
  args: {
    msg: assistantWithToolCall,
    index: 1,
    isLast: true,
    streaming: false,
    planMessageIdx: -1,
    planSteps: [],
    agentPlans: {},
    collapseAgents: false,
    onRetry: () => alert('retry'),
  },
};

export const AssistantInterrupted: Story = {
  args: {
    msg: assistantInterrupted,
    index: 1,
    isLast: true,
    streaming: false,
    planMessageIdx: -1,
    planSteps: [],
    agentPlans: {},
    collapseAgents: false,
    onRetry: () => alert('retry'),
  },
};

export const AssistantFromAgent: Story = {
  args: {
    msg: assistantFromAgent,
    index: 1,
    isLast: true,
    streaming: false,
    planMessageIdx: -1,
    planSteps: [],
    agentPlans: {},
    collapseAgents: false,
    onRetry: () => alert('retry'),
  },
};
