import type { Meta, StoryObj } from '@storybook/react-vite';
import Sidebar from './Sidebar';
import type { Conversation } from './Sidebar';

const sampleConversations: Conversation[] = [
  { id: 'conv-1', title: 'TypeScript 快速排序实现' },
  { id: 'conv-2', title: 'React 19 新特性深度解析' },
  { id: 'conv-3', title: 'LangGraph 多智能体编排最佳实践' },
  { id: 'conv-4', title: 'PostgreSQL 索引优化方案' },
  { id: 'conv-5', title: 'Qdrant 向量检索性能对比' },
];

const meta: Meta<typeof Sidebar> = {
  title: 'Components/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onSelect: (id) => console.log('select', id),
    onNewSession: () => alert('new session'),
    onDelete: (id) => alert('delete ' + id),
    onSettings: () => alert('settings'),
  },
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

export const WithConversations: Story = {
  args: {
    conversations: sampleConversations,
    activeId: 'conv-2',
  },
};

export const Empty: Story = {
  args: {
    conversations: [],
    activeId: '',
  },
};

export const FirstActive: Story = {
  args: {
    conversations: sampleConversations.slice(0, 3),
    activeId: 'conv-1',
  },
};
