// SettingsPage — 模型配置 + MCP 服务器管理页面
// 功能:Tab 切换 — 模型配置 CRUD / MCP 服务器 CRUD
// 数据通过 REST API 与后端交互
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Check, Pencil, X, Network } from 'lucide-react';
import { api } from '../lib/api';
import type { ModelConfig, McpServerConfig, McpServerPayload } from '@ai-voice/shared';

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
  const [mcpJsonInput, setMcpJsonInput] = useState('');

  const loadConfigs = useCallback(async () => {
    try {
      const raw = await api.configs.list();
      setConfigs(raw);
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
    setMcpJsonInput('');
  };

  const handleMcpJsonParse = () => {
    if (!mcpJsonInput.trim()) return;
    try {
      const json = JSON.parse(mcpJsonInput);
      setMcpForm({
        name: json.name || mcpForm.name,
        transport: json.transport === 'sse' ? 'sse' : 'stdio',
        command: json.command
          ? json.args
            ? `${json.command} ${json.args.join(' ')}`
            : json.command
          : mcpForm.command,
        url: json.url || mcpForm.url,
        isActive: mcpForm.isActive,
      });
      setMcpJsonInput('');
    } catch {
      alert('JSON 格式错误，请检查后重试');
    }
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
    <div className="flex flex-col flex-1 min-w-0 bg-gradient-to-b from-[#FAFBFC] to-[#FFFFFF]">
      <header className="flex items-center gap-3 border-b border-[#EBECF0] h-16 px-6 flex-shrink-0 bg-gradient-to-r from-[#F8F9FC] to-transparent">
        <button
          onClick={() => navigate('/')}
          className="rounded-xl p-2 text-[#6366F1] hover:bg-[#6366F118] transition-all shadow-sm hover:shadow"
          title="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 bg-[#F0F1F5] rounded-xl p-1">
          <button
            onClick={() => setTab('models')}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              tab === 'models'
                ? 'bg-gradient-to-r from-[#6366F1] to-[#5558E6] text-white shadow-sm'
                : 'text-[#666] hover:text-[#1A1A2E]'
            }`}
          >
            模型配置
          </button>
          <button
            onClick={() => setTab('mcp')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              tab === 'mcp'
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-sm'
                : 'text-[#666] hover:text-[#1A1A2E]'
            }`}
          >
            <Network size={14} /> MCP 服务器
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {tab === 'models' && loading && (
          <div className="flex flex-col items-center justify-center gap-3 mt-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent" />
            <span className="text-[12px] text-[#999]">正在加载模型配置...</span>
          </div>
        )}

        {tab === 'models' && (
          <>
            {!loading && configs.length === 0 && editingId === null && (
              <div className="flex flex-col items-center justify-center mt-12 py-8">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F0F1F5] to-[#E8E8EC] flex items-center justify-center mb-3">
                  <svg
                    className="w-6 h-6 text-[#999]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <p className="text-[12px] text-[#999] text-center">暂无模型配置</p>
                <p className="text-[11px] text-[#BBB] text-center mt-1">
                  点击下方按钮添加您的第一个模型
                </p>
              </div>
            )}

            {configs.map((c) =>
              editingId === c.id ? null : (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${
                    c.isSelected
                      ? 'border-[#6366F1] bg-gradient-to-r from-[#6366F108] to-[#8B5CF608] shadow-sm'
                      : 'border-[#EBECF0] bg-white hover:border-[#E8E8EC] hover:shadow-sm'
                  }`}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background:
                        c.modelProvider === 'openai'
                          ? 'linear-gradient(135deg, #10A37F20, #10A37F10)'
                          : c.modelProvider === 'anthropic'
                            ? 'linear-gradient(135deg, #D4A57420, #D4A57410)'
                            : 'linear-gradient(135deg, #FF6B3520, #FF6B3510)',
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          c.modelProvider === 'openai'
                            ? '#10A37F'
                            : c.modelProvider === 'anthropic'
                              ? '#D4A574'
                              : '#FF6B35',
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-[#1A1A2E]">{displayName(c)}</span>
                    <span className="ml-2 text-[11px] text-[#999]">
                      T={c.temperature.toFixed(1)}
                    </span>
                    {c.isSelected && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-[#6366F1] font-semibold bg-[#6366F118] rounded-full px-1.5 py-0.5">
                        <Check size={10} /> 当前使用
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded-lg p-1.5 text-[#8888AA] hover:bg-[#F0F1F5] hover:text-[#1A1A2E] transition-all"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#FEF2F2] transition-all"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                    {!c.isSelected && (
                      <button
                        onClick={() => handleSelect(c.id)}
                        className="rounded-lg px-2.5 py-1 text-[11px] text-[#6366F1] hover:bg-[#EEF2FF] font-medium transition-all"
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
                className="rounded-2xl border-2 border-[#6366F1] bg-gradient-to-br from-white to-[#F8F9FC] p-5 space-y-4"
                style={{ boxShadow: '0 4px 12px rgba(99,102,241,0.15)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#6366F1] to-[#8B5CF6]" />
                    <span className="text-[12px] font-semibold text-[#6366F1]">
                      {editingId ? '编辑模型' : '添加模型'}
                    </span>
                  </div>
                  <button
                    onClick={resetForm}
                    className="rounded-lg p-1.5 text-[#999] hover:text-[#1A1A2E] hover:bg-[#F0F1F5] transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block font-medium">提供商</label>
                    <select
                      className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none bg-white focus:border-[#6366F1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                      value={form.modelProvider}
                      onChange={(e) => setForm((f) => ({ ...f, modelProvider: e.target.value }))}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="ollama">Ollama</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block font-medium">
                      模型名称
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none focus:border-[#6366F1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                      placeholder="gpt-4o / claude-sonnet-4 ..."
                      value={form.modelName}
                      onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block font-medium">
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
                  <label className="text-[11px] text-[#999] mb-1 block font-medium">API Key</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none focus:border-[#6366F1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                    placeholder="sk-..."
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block font-medium">
                    Base URL(可选)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none focus:border-[#6366F1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                    placeholder="https://api.openai.com/v1"
                    value={form.baseUrl}
                    onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={resetForm}
                    className="rounded-xl px-4 py-2 text-[12px] text-[#666] hover:bg-[#F5F6FA] transition-all font-medium"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!form.modelName.trim() || saving}
                    className="rounded-xl px-5 py-2 text-[12px] font-semibold text-white bg-gradient-to-r from-[#6366F1] to-[#5558E6] hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>保存中...</span>
                      </>
                    ) : (
                      '保存'
                    )}
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
              <div className="flex flex-col items-center justify-center mt-12 py-8">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F0F1F5] to-[#E8E8EC] flex items-center justify-center mb-3">
                  <svg
                    className="w-6 h-6 text-[#999]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                  </svg>
                </div>
                <p className="text-[12px] text-[#999] text-center">暂无 MCP 服务器配置</p>
                <p className="text-[11px] text-[#BBB] text-center mt-1">
                  点击下方按钮添加您的第一个 MCP 服务器
                </p>
              </div>
            )}

            {mcpServers.map((s) =>
              mcpEditingId === s.id ? null : (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-[#EBECF0] bg-white px-4 py-3 hover:border-[#E8E8EC] hover:shadow-sm transition-all"
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF620, #8B5CF610)',
                    }}
                  >
                    <Network size={14} className="text-[#8B5CF6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#1A1A2E]">{s.name}</span>
                      <span className="text-[10px] text-[#8B5CF6] rounded-full border border-[#8B5CF640] bg-[#8B5CF608] px-1.5 py-0.5 font-medium">
                        {s.transport}
                      </span>
                      <button
                        onClick={() => handleMcpToggle(s)}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-all ${
                          s.isActive
                            ? 'bg-[#10B98118] text-[#10B981] hover:bg-[#10B98128]'
                            : 'bg-[#99999918] text-[#999] hover:bg-[#99999928]'
                        }`}
                      >
                        {s.isActive ? '● 活跃' : '○ 禁用'}
                      </button>
                    </div>
                    <div className="text-[11px] text-[#999] mt-0.5 truncate font-mono">
                      {s.transport === 'stdio' ? s.command : s.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startMcpEdit(s)}
                      className="rounded-lg p-1.5 text-[#8888AA] hover:bg-[#F0F1F5] hover:text-[#1A1A2E] transition-all"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleMcpDelete(s.id)}
                      className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#FEF2F2] transition-all"
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
                className="rounded-2xl border-2 border-[#8B5CF6] bg-gradient-to-br from-white to-[#F8F9FC] p-5 space-y-4"
                style={{ boxShadow: '0 4px 12px rgba(139,92,246,0.15)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#8B5CF6] to-[#7C3AED]" />
                    <span className="text-[12px] font-semibold text-[#8B5CF6]">
                      {mcpEditingId ? '编辑 MCP 服务器' : '添加 MCP 服务器'}
                    </span>
                  </div>
                  <button
                    onClick={resetMcpForm}
                    className="rounded-lg p-1.5 text-[#999] hover:text-[#1A1A2E] hover:bg-[#F0F1F5] transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block font-medium">名称</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none focus:border-[#8B5CF6] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all"
                    placeholder="filesystem-server"
                    value={mcpForm.name}
                    onChange={(e) => setMcpForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#999] mb-1 block font-medium">传输类型</label>
                  <select
                    className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none bg-white focus:border-[#8B5CF6] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all"
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
                    <label className="text-[11px] text-[#999] mb-1 block font-medium">
                      启动命令
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none focus:border-[#8B5CF6] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all font-mono"
                      placeholder="npx -y @modelcontextprotocol/server-filesystem /tmp"
                      value={mcpForm.command}
                      onChange={(e) => setMcpForm((f) => ({ ...f, command: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block font-medium">
                      服务器 URL
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none focus:border-[#8B5CF6] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all font-mono"
                      placeholder="http://localhost:3001/sse"
                      value={mcpForm.url}
                      onChange={(e) => setMcpForm((f) => ({ ...f, url: e.target.value }))}
                    />
                  </div>
                )}

                {mcpForm.transport === 'stdio' && (
                  <div>
                    <label className="text-[11px] text-[#999] mb-1 block font-medium">
                      JSON 配置导入（可选）
                    </label>
                    <textarea
                      className="w-full rounded-xl border-2 border-[#EBECF0] px-3 py-2 text-[12px] text-[#1A1A2E] outline-none focus:border-[#8B5CF6] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all font-mono resize-none"
                      rows={4}
                      placeholder={
                        '{\n  "name": "pencil",\n  "transport": "stdio",\n  "command": "C:\\\\path\\\\to\\\\server.exe",\n  "args": ["--app", "desktop"],\n  "env": {}\n}'
                      }
                      value={mcpJsonInput}
                      onChange={(e) => setMcpJsonInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleMcpJsonParse}
                      disabled={!mcpJsonInput.trim()}
                      className="mt-1.5 rounded-xl px-3 py-1.5 text-[11px] text-[#8B5CF6] border-2 border-[#8B5CF6] hover:bg-[#8B5CF610] disabled:opacity-40 transition-all font-medium"
                    >
                      解析并填充
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={resetMcpForm}
                    className="rounded-xl px-4 py-2 text-[12px] text-[#666] hover:bg-[#F5F6FA] transition-all font-medium"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleMcpSave}
                    disabled={!mcpForm.name.trim() || mcpSaving}
                    className="rounded-xl px-5 py-2 text-[12px] font-semibold text-white bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {mcpSaving ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>保存中...</span>
                      </>
                    ) : (
                      '保存'
                    )}
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
