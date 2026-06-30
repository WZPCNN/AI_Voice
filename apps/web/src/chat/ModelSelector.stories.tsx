import type { Meta, StoryObj } from '@storybook/react-vite';
import ModelSelector from './ModelSelector';
import { useConfigStore } from '../store/configStore';
import type { ModelConfig } from '@ai-voice/shared';

const sampleConfigs: ModelConfig[] = [
  {
    id: 'cfg-1',
    userId: 'user-1',
    modelProvider: 'openai',
    modelName: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    tools: [],
    apiKey: 'sk-****abcd',
    isSelected: true,
  },
  {
    id: 'cfg-2',
    userId: 'user-1',
    modelProvider: 'anthropic',
    modelName: 'claude-sonnet-4',
    temperature: 0.5,
    maxTokens: 8192,
    tools: [],
    apiKey: null,
    isSelected: false,
  },
  {
    id: 'cfg-3',
    userId: 'user-1',
    modelProvider: 'ollama',
    modelName: 'llama3',
    temperature: 0.9,
    maxTokens: 2048,
    tools: [],
    apiKey: null,
    isSelected: false,
  },
];

const meta: Meta<typeof ModelSelector> = {
  title: 'Chat/ModelSelector',
  component: ModelSelector,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    onAddModel: () => alert('add model'),
  },
};

export default meta;
type Story = StoryObj<typeof ModelSelector>;

export const WithConfigs: Story = {
  render: (args) => {
    useConfigStore.setState({
      configs: sampleConfigs,
      selectedConfigId: 'cfg-1',
      configDropdownOpen: false,
    });
    return (
      <div className="w-96 border border-[#EBECF0] rounded-lg p-4 bg-white">
        <ModelSelector {...args} />
      </div>
    );
  },
};

export const EmptyConfigs: Story = {
  render: (args) => {
    useConfigStore.setState({
      configs: [],
      selectedConfigId: null,
      configDropdownOpen: false,
    });
    return (
      <div className="w-96 border border-[#EBECF0] rounded-lg p-4 bg-white">
        <ModelSelector {...args} />
      </div>
    );
  },
};

export const DropdownOpen: Story = {
  render: (args) => {
    useConfigStore.setState({
      configs: sampleConfigs,
      selectedConfigId: 'cfg-1',
      configDropdownOpen: true,
    });
    return (
      <div className="w-96 border border-[#EBECF0] rounded-lg p-4 bg-white h-72">
        <ModelSelector {...args} />
      </div>
    );
  },
};
