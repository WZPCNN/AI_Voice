// SettingsPage — 模型配置 + MCP 服务器管理页面
// 功能:Tab 切换 — 模型配置 CRUD / MCP 服务器 CRUD
// 数据通过 REST API 与后端交互
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Check, Pencil, X, Network } from 'lucide-react';
import { api } from '../lib/api';
import type { ModelConfig, McpServerConfig, McpServerPayload } from '@agent-platform/shared';

type Tab = 'models' | 'mcp';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('models');
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    modelProvider: 'openai',
    modelName: '',
    temperature: 0.7,
    apiKey: '',
    baseUrl: '',
  });
  const [saving, setSaving] = useState(false);

  // MCP 服务器状态
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [mcpEditingId, setMcpEditingId] = useState<string | null>(null);
  const [mcpForm, setMcpForm] = useState<McpServerPayload>({
    name: '',
    transport: 'stdio',
    command: '',
    url: '',
    isActive: true,
  });
  const [mcpSaving, setMcpSaving] = useState(false);

  const loadConfigs = useCallback(async () => {
    try {
      const raw = await api.configs.list();
      setConfigs(Array.isArray(raw) ? raw : (raw.data ?? []));
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const loadMcpServers = useCallback(async () => {
    try {
      const raw = await api.mcpServers.list();
      setMcpServers(Array.isArray(raw) ? raw : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMcpServers();
  }, [loadMcpServers]);

  const resetMcpForm = () => {
    setMcpForm({ name: '', transport: 'stdio', command: '', url: '', isActive: true });
    setMcpEditingId(null);
  };

  const startMcpEdit = (s: McpServerConfig) => {
    setMcpEditingId(s.id);
    setMcpForm({
      name: s.name,
      transport: s.transport,
      command: s.command ?? '',
      url: s.url ?? '',
      isActive: s.isActive,
    });
  };

  const handleMcpSave = async () => {
    if (!mcpForm.name.trim()) return;
    setMcpSaving(true);
    try {
      const body: McpServerPayload = {
        name: mcpForm.name.trim(),
        transport: mcpForm.transport,
        command: mcpForm.command || undefined,
        url: mcpForm.url || undefined,
        isActive: mcpForm.isActive,
      };
      if (mcpEditingId) {
        await api.mcpServers.update(mcpEditingId, body);
      } else {
        await api.mcpServers.create(body);
      }
      resetMcpForm();
      await loadMcpServers();
    } catch {
      /* ignore */
    }
    setMcpSaving(false);
  };

  const handleMcpDelete = async (id: string) => {
    try {
      await api.mcpServers.delete(id);
      await loadMcpServers();
    } catch {
      /* ignore */
    }
  };

  const handleMcpToggle = async (s: McpServerConfig) => {
    try {
      await api.mcpServers.update(s.id, { isActive: !s.isActive });
      await loadMcpServers();
    } catch {
      /* ignore */
    }
  };

  const resetForm = () => {
    setForm({ modelProvider: 'openai', modelName: '', temperature: 0.7, apiKey: '', baseUrl: '' });
    setEditingId(null);
  };

  const startEdit = (c: ModelConfig) => {
    setEditingId(c.id);
    setForm({
      modelProvider: c.modelProvider,
      modelName: c.modelName,
      temperature: c.temperature,
      apiKey: c.apiKey ?? '',
      baseUrl: c.baseUrl ?? '',
    });
  };

  const handleSave = async () => {
    if (!form.modelName.trim()) return;
    setSaving(true);
    try {
      const body = {
        modelProvider: form.modelProvider,
        modelName: form.modelName.trim(),
        temperature: form.temperature,
        apiKey: form.apiKey || null,
        baseUrl: form.baseUrl || null,
      };
      if (editingId) {
        await api.configs.update(editingId, body);
      } else {
        await api.configs.create(body);
      }
      resetForm();
      await loadConfigs();
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.configs.delete(id);
      await loadConfigs();
    } catch {
      /* ignore */
    }
  };

  const handleSelect = async (id: string) => {
    try {
      await api.configs.select(id);
      await loadConfigs();
    } catch {
      /* ignore */
    }
  };

  const displayName = (c: ModelConfig) => `${c.modelProvider}/${c.modelName}`;

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-[#FFFFFF]">
      <header className="flex items-center gap-3 border-b border-[#EBECF0] h-16 px-6 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-1.5 text-[#8888AA] hover:bg-[#F0F1F5] hover:text-[#1A1A2E] transition-colors"
          title="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={() => setTab('models')}
          className={`px-3 py-1 rounded-md text-[13px] font-medium transition-colors ${
            tab === 'models' ? 'bg-[#6366F1] text-white' : 'text-[#666] hover:bg-[#F0F1F5]'
          }`}
        >
          模型配置
        </button>
        <button
          onClick={() => setTab('mcp')}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-[13px] font-medium transition-colors ${
            tab === 'mcp' ? 'bg-[#8B5CF6] text-white' : 'text-[#666] hover:bg-[#F0F1F5]'
          }`}
        >
          <Network size={14} /> MCP 服务器
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {tab === 'models' && loading && (
          <p className="text-[12px] text-[#999] text-center mt-12">加载中...</p>
        )}

        {tab === 'models' && (
          <>
            {!loading && configs.length === 0 && editingId === null && (
              <p className="text-[12px] text-[#999] text-center mt-12">
                暂无模型配置,点击下方按钮添加
              </p>
            )}

            {configs.map((c) =>
              editingId === c.id ? null : (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    c.isSelected
                      ? 'border-[#6366F1] bg-[#EEF2FF]'
                      : 'border-[#EBECF0] bg-white hover:bg-[#F5F6FA]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-[#1A1A2E]">{displayName(c)}</span>
                    <span className="ml-2 text-[11px] text-[#999]">
                      T={c.temperature.toFixed(1)}
                    </span>
                    {c.isSelected && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-[#6366F1] font-medium">
                        <Check size={10} /> 当前使用
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded-md p-1.5 text-[#8888AA] hover:bg-[#F0F1F5] hover:text-[#1A1A2E] transition-colors"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rounded-md p-1.5 text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                    {!c.isSelected && (
                      <button
                        onClick={() => handleSelect(c.id)}
                        className="rounded-md px-2 py-1 text-[11px] text-[#6366F1] hover:bg-[#EEF2FF] font-medium transition-colors"
                        title="选择此模型"
                      >
                        选择
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}

            {editingId !== null && (
              <div
                className="rounded-2xl border-2 border-[#6366F1] bg-white p-5 space-y-4"
                style={{ boxShadow: '0 0 0 3px rgba(99,102,241,0.1)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#6366F1]">
                    {editingId ? '编辑模型' : '添加模型'}
                  </span>
                  <button
                    onClick={resetForm}
                    className="rounded-md p-1 text-[#999] hover:text-[#1A1A2E] hover:bg-[#F0F1F5] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block">提供商</label>
                    <select
                      className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none bg-white"
                      value={form.modelProvider}
                      onChange={(e) => setForm((f) => ({ ...f, modelProvider: e.target.value }))}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="ollama">Ollama</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block">模型名称</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none focus:border-[#6366F1]"
                      placeholder="gpt-4o / claude-sonnet-4 ..."
                      value={form.modelName}
                      onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block">
                    Temperature: {form.temperature.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={form.temperature}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-[#6366F1] h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-[#999] mt-0.5">
                    <span>精确 0</span>
                    <span>1.0</span>
                    <span>创造性 2</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block">API Key</label>
                  <input
                    type="password"
                    className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none focus:border-[#6366F1]"
                    placeholder="sk-..."
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block">Base URL(可选)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none focus:border-[#6366F1]"
                    placeholder="https://api.openai.com/v1"
                    value={form.baseUrl}
                    onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={resetForm}
                    className="rounded-lg px-3.5 py-1.5 text-[12px] text-[#666] hover:bg-[#F5F6FA] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!form.modelName.trim() || saving}
                    className="rounded-lg px-4 py-1.5 text-[12px] font-medium text-white bg-[#6366F1] hover:bg-[#5558E6] disabled:opacity-50 transition-colors"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                resetForm();
                setEditingId('');
              }}
              className="w-full rounded-lg border-2 border-dashed border-[#D4D6DD] py-3 text-[12px] text-[#999] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors"
            >
              + 添加模型
            </button>
          </>
        )}

        {tab === 'mcp' && (
          <>
            {mcpServers.length === 0 && mcpEditingId === null && (
              <p className="text-[12px] text-[#999] text-center mt-12">
                暂无 MCP 服务器配置,点击下方按钮添加
              </p>
            )}

            {mcpServers.map((s) =>
              mcpEditingId === s.id ? null : (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-[#EBECF0] bg-white px-4 py-3 hover:bg-[#F5F6FA] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Network size={14} className="text-[#8B5CF6]" />
                      <span className="text-[13px] font-medium text-[#1A1A2E]">{s.name}</span>
                      <span className="text-[10px] text-[#999] rounded border border-[#EBECF0] px-1">
                        {s.transport}
                      </span>
                      <button
                        onClick={() => handleMcpToggle(s)}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          s.isActive
                            ? 'bg-[#10B98118] text-[#10B981]'
                            : 'bg-[#99999918] text-[#999]'
                        }`}
                      >
                        {s.isActive ? '活跃' : '禁用'}
                      </button>
                    </div>
                    <div className="text-[11px] text-[#999] mt-0.5 truncate">
                      {s.transport === 'stdio' ? s.command : s.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startMcpEdit(s)}
                      className="rounded-md p-1.5 text-[#8888AA] hover:bg-[#F0F1F5] hover:text-[#1A1A2E] transition-colors"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleMcpDelete(s.id)}
                      className="rounded-md p-1.5 text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ),
            )}

            {mcpEditingId !== null && (
              <div
                className="rounded-2xl border-2 border-[#8B5CF6] bg-white p-5 space-y-4"
                style={{ boxShadow: '0 0 0 3px rgba(139,92,246,0.1)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#8B5CF6]">
                    {mcpEditingId ? '编辑 MCP 服务器' : '添加 MCP 服务器'}
                  </span>
                  <button
                    onClick={resetMcpForm}
                    className="rounded-md p-1 text-[#999] hover:text-[#1A1A2E] hover:bg-[#F0F1F5] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block">名称</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none focus:border-[#8B5CF6]"
                    placeholder="filesystem-server"
                    value={mcpForm.name}
                    onChange={(e) => setMcpForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block">传输类型</label>
                  <select
                    className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none bg-white"
                    value={mcpForm.transport}
                    onChange={(e) =>
                      setMcpForm((f) => ({ ...f, transport: e.target.value as 'stdio' | 'sse' }))
                    }
                  >
                    <option value="stdio">stdio (子进程)</option>
                    <option value="sse">sse (HTTP)</option>
                  </select>
                </div>

                {mcpForm.transport === 'stdio' ? (
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block">启动命令</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none focus:border-[#8B5CF6] font-mono"
                      placeholder="npx -y @modelcontextprotocol/server-filesystem /tmp"
                      value={mcpForm.command}
                      onChange={(e) => setMcpForm((f) => ({ ...f, command: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block">服务器 URL</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#1A1A2E] outline-none focus:border-[#8B5CF6] font-mono"
                      placeholder="http://localhost:3001/sse"
                      value={mcpForm.url}
                      onChange={(e) => setMcpForm((f) => ({ ...f, url: e.target.value }))}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={resetMcpForm}
                    className="rounded-lg px-3.5 py-1.5 text-[12px] text-[#666] hover:bg-[#F5F6FA] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleMcpSave}
                    disabled={!mcpForm.name.trim() || mcpSaving}
                    className="rounded-lg px-4 py-1.5 text-[12px] font-medium text-white bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 transition-colors"
                  >
                    {mcpSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                resetMcpForm();
                setMcpEditingId('');
              }}
              className="w-full rounded-lg border-2 border-dashed border-[#D4D6DD] py-3 text-[12px] text-[#999] hover:border-[#8B5CF6] hover:text-[#8B5CF6] transition-colors"
            >
              + 添加 MCP 服务器
            </button>
          </>
        )}
      </div>
    </div>
  );
}
