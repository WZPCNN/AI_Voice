import type { Meta, StoryObj } from '@storybook/react-vite';
import SlashCommandPalette from './SlashCommandPalette';
import { COMMANDS } from '../components/slashCommands';
import type { AppMode } from '@ai-voice/shared';

const meta: Meta<typeof SlashCommandPalette> = {
  title: 'Chat/SlashCommandPalette',
  component: SlashCommandPalette,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  render: (args) => (
    <div className="relative h-32 max-w-md mx-auto">
      <SlashCommandPalette {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof SlashCommandPalette>;

export const Default: Story = {
  args: {
    query: '/mode',
    cmds: COMMANDS,
    selectedIdx: 0,
    modes: [],
    onSelectIdx: (i) => console.log('select', i),
    onExecute: (cmd) => alert('execute: ' + cmd.id),
  },
};

export const WithMultiActive: Story = {
  args: {
    query: '/mode',
    cmds: COMMANDS,
    selectedIdx: 0,
    modes: ['multi' as AppMode],
    onSelectIdx: (i) => console.log('select', i),
    onExecute: (cmd) => alert('execute: ' + cmd.id),
  },
};

export const SelectedSecond: Story = {
  args: {
    query: '/mode',
    cmds: COMMANDS,
    selectedIdx: 1,
    modes: ['plan' as AppMode, 'mcp' as AppMode],
    onSelectIdx: (i) => console.log('select', i),
    onExecute: (cmd) => alert('execute: ' + cmd.id),
  },
};
