-- Initial database schema for Agent Platform
-- Run against PostgreSQL with pgvector extension enabled

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL DEFAULT 'New Session',
  model_id VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
  mode VARCHAR(50) NOT NULL DEFAULT 'execute',
  context_summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'agent')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
  model_name VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
  temperature REAL NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 4096,
  tools TEXT[] NOT NULL DEFAULT '{}',
  system_prompt TEXT,
  api_key TEXT,
  base_url TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default user for local development
INSERT INTO users (id, name, email) VALUES ('00000000-0000-0000-0000-000000000001', 'default-user', 'default@local') ON CONFLICT DO NOTHING;

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_sessions_user ON sessions(user_id, updated_at DESC);

-- MCP 服务器配置表 — 用户可配置外部 Model Context Protocol 服务器
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  transport VARCHAR(20) NOT NULL DEFAULT 'stdio',
  command TEXT,
  url TEXT,
  env JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_servers_user ON mcp_servers(user_id);
