// 共享类型定义 — 跨前后端共用的数据模型
// 这些类型被 apps/api-server(后端)和 apps/web(前端)共同引用,
// 保证前后端数据结构的一致性

/**
 * Mode — 应用工作模式常量
 * multi — 多智能体协作(协调者 + 研究员 + 编码者 + 审阅者)
 * plan — 计划模式(任务分解与逐步执行)
 * execute — 直接执行模式(默认,无规划阶段)
 */
export const Mode = {
  EXECUTE: 'execute',
  PLAN: 'plan',
  MULTI: 'multi',
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

/**
 * PlanStepStatus — 计划步骤状态常量
 */
export const PlanStepStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type PlanStepStatus = (typeof PlanStepStatus)[keyof typeof PlanStepStatus];

/**
 * User — 用户实体
 * 对应数据库 User 表
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'user' | 'admin';
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session — 会话实体
 * 对应数据库 Session 表,记录一次对话会话
 */
export interface Session {
  id: string;
  userId: string;
  title: string;
  modelId?: string;
  mode: Mode;
  contextSummary?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message — 单条对话消息(合并前后端定义)
 * 前端视图:role/content/agent/toolCall/interrupted/images
 * 后端实体:id/sessionId/metadata/createdAt
 * 所有后端字段可选,前端创建时无需提供
 */
export interface Message {
  /** 消息 ID(后端生成) */
  id?: string;
  /** 所属会话 ID */
  sessionId?: string;
  /** 消息角色:user/assistant/tool/agent */
  role: 'user' | 'assistant' | 'tool' | 'agent';
  /** 消息文本内容 */
  content: string;
  /** 附加图片(Base64 编码,用于多模态输入) */
  images?: string[];
  /** 工具调用详情 */
  toolCall?: { tool: string; output?: string };
  /** 多智能体模式下,发送消息的 Agent 名称 */
  agent?: string;
  /** 标记响应是否被中断 */
  interrupted?: boolean;
  /** 中断原因:user=用户主动中断,error=异常中断 */
  interruptReason?: 'user' | 'error';
  /** 元数据(工具名、耗时等) */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt?: string;
}

/**
 * PlanStep — 计划步骤(合并前后端定义)
 * 前端用 step/assignee/status/detail
 * 后端用 id/description/subSteps
 * step 为必需字段(前端展示用),其余可选
 */
export interface PlanStep {
  /** 步骤 ID(后端生成) */
  id?: string;
  /** 步骤描述文本(前端主要字段) */
  step: string;
  /** 步骤描述(后端字段名,兼容用) */
  description?: string;
  /** 负责执行的专家 Agent 名称 */
  assignee?: string;
  /** 执行状态 */
  status: PlanStepStatus;
  /** 详细输出/思考过程(支持 Markdown) */
  detail?: string;
  /** 子步骤(支持嵌套计划) */
  subSteps?: PlanStep[];
}

/**
 * AgentInfo — 当前正在运行的专家 Agent 信息
 * 用于 UI 顶部展示活跃 Agent 列表
 */
export interface AgentInfo {
  /** Agent 内部标识(coordinator/researcher/coder/reviewer) */
  agent: string;
  /** 显示名称 */
  name: string;
  /** 徽章颜色(十六进制) */
  color: string;
}

/**
 * ChatChunk — SSE 流式数据块
 * 后端通过 /api/chat/stream 接口以 SSE 形式推送,
 * 每个 chunk 携带一类事件(token/plan/step/tool/agent 等)
 */
export interface ChatChunk {
  /** 事件类型:token/tool_start/tool_end/done/error/plan/step_start/step_complete/agent_start/agent_end */
  type: string;
  /** 文本内容(token 类型用) */
  content?: string;
  /** 工具名称(tool_start/tool_end 用) */
  tool?: string;
  /** 工具输出(tool_end 用) */
  output?: string;
  /** 规划步骤数组(plan 类型用) */
  steps?: { step: string; assignee?: string }[];
  /** 步骤索引(step_start/step_complete 用) */
  index?: number;
  /** 步骤名称 */
  step?: string;
  /** Agent 标识 */
  agent?: string;
  /** Agent 显示名称 */
  name?: string;
  /** Agent 显示颜色 */
  color?: string;
  /** 错误消息(error 类型用) */
  message?: string;
}

/** StreamChunk — ChatChunk 的兼容别名(前端历史命名) */
export type StreamChunk = ChatChunk;

/**
 * AppMode — 应用工作模式
 * multi/plan/exec 三种基础模式 + skills/mcp 两种扩展模式
 * - multi: 多智能体协作
 * - plan: 计划模式(任务分解与逐步执行)
 * - exec: 直接执行模式(默认)
 * - skills: 技能模式(选择专用技能:代码审查/摘要/搜索)
 * - mcp: MCP 模式(连接外部 MCP 服务器,使用其工具)
 */
export type AppMode = 'multi' | 'plan' | 'exec' | 'skills' | 'mcp';

/**
 * SkillInfo — 内置技能信息(前端展示用)
 * 与 Python 端 agents/src/skills/registry.py 的 BUILTIN_SKILLS 对应
 */
export interface SkillInfo {
  /** 技能 ID(code-review / summarize / web-search) */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标颜色(十六进制) */
  color: string;
}

/**
 * McpServerConfig — MCP 服务器配置实体
 * 对应数据库 mcp_servers 表
 * 用户可配置多个外部 MCP 服务器,在 mcp 模式下由 Agent 连接并使用其工具
 */
export interface McpServerConfig {
  id: string;
  userId: string;
  name: string;
  /** 传输类型: stdio(子进程) 或 sse(HTTP SSE) */
  transport: 'stdio' | 'sse';
  /** stdio 模式下的启动命令(如 "npx -y @modelcontextprotocol/server-filesystem") */
  command?: string;
  /** sse 模式下的服务器 URL */
  url?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** McpServerPayload — 创建或更新 MCP 服务器配置的请求体 */
export interface McpServerPayload {
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  url?: string;
  env?: Record<string, string>;
  isActive?: boolean;
}

/**
 * AgentConfig — Agent 模型配置实体
 * 对应数据库 agent_configs 表
 * 注意:apiKey 字段在对外返回时已脱敏(如 "sk-****xxxx")
 */
export interface AgentConfig {
  id: string;
  userId: string;
  modelProvider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  systemPrompt?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  isSelected?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** ModelConfig — 前端视图别名,与 AgentConfig 相同(apiKey 已脱敏) */
export type ModelConfig = AgentConfig;

/** ModelConfigPayload — 创建或更新模型配置的请求体 */
export interface ModelConfigPayload {
  modelProvider: string;
  modelName: string;
  temperature: number;
  maxTokens?: number;
  tools?: string[];
  systemPrompt?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * AgentPlan — 智能体计划
 * 记录一次会话的完整执行计划
 */
export interface AgentPlan {
  id: string;
  sessionId: string;
  steps: PlanStep[];
  createdAt: string;
}

/**
 * ProviderConfig — 模型提供商配置(前端展示用)
 */
export interface ProviderConfig {
  label: string;
  models: string[];
}
