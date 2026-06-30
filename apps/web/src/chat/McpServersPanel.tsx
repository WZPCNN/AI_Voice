// McpServersPanel — MCP 服务器状态面板
// 当 mcp 模式激活时显示,展示已配置的 MCP 服务器列表和活跃状态
import { memo, useState, useEffect } from 'react';
import { Network, Settings, Circle } from 'lucide-react';
import { api } from '../lib/api';
import type { McpServerConfig } from '@ai-voice/shared';

function McpServersPanel({ onNavigateSettings }: { onNavigateSettings: () => void }) {
  const [servers, setServers] = useState<McpServerConfig[]>([]);

  useEffect(() => {
    api.mcpServers
      .list()
      .then(setServers)
      .catch(() => {});
  }, []);

  const activeCount = servers.filter((s) => s.isActive).length;

  return (
    <div className="flex items-center gap-2 rounded-md border border-[#8B5CF6] bg-[#8B5CF618] px-2.5 py-1">
      <Network size={12} className="text-[#8B5CF6]" />
      <span className="text-[11px] font-medium text-[#8B5CF6]">
        {activeCount}/{servers.length} 个 MCP 服务器活跃
      </span>
      {servers.length === 0 && <span className="text-[10px] text-[#999]">未配置服务器</span>}
      <button
        type="button"
        onClick={onNavigateSettings}
        className="ml-1 inline-flex items-center gap-0.5 rounded text-[10px] text-[#8B5CF6] hover:underline"
      >
        <Settings size={10} /> 管理
      </button>
      {servers.slice(0, 3).map((s) => (
        <span key={s.id} className="inline-flex items-center gap-0.5 text-[10px] text-[#666]">
          <Circle
            size={6}
            fill={s.isActive ? '#10B981' : '#D4D6DD'}
            color={s.isActive ? '#10B981' : '#D4D6DD'}
          />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export default memo(McpServersPanel);
