#!/bin/bash
# 文档工具综合验证脚本
# 用于本地验证所有文档工具是否能成功构建

set -e

echo "🔍 开始验证文档工具..."

# 1. 验证 TypeDoc (api-server)
echo "📚 验证 TypeDoc (api-server)..."
pnpm --filter @ai-voice/api-server docs:typedoc
if [ -d "apps/api-server/docs/typedoc" ]; then
  echo "✅ TypeDoc (api-server) 构建成功"
else
  echo "❌ TypeDoc (api-server) 构建失败"
  exit 1
fi

# 2. 验证 TypeDoc (shared)
echo "📚 验证 TypeDoc (shared)..."
pnpm --filter @ai-voice/shared docs:typedoc
if [ -d "packages/shared/docs/typedoc" ]; then
  echo "✅ TypeDoc (shared) 构建成功"
else
  echo "❌ TypeDoc (shared) 构建失败"
  exit 1
fi

# 3. 验证 Compodoc (api-server)
echo "📚 验证 Compodoc (api-server)..."
pnpm --filter @ai-voice/api-server docs:compodoc
if [ -d "apps/api-server/docs/compodoc" ]; then
  echo "✅ Compodoc (api-server) 构建成功"
else
  echo "❌ Compodoc (api-server) 构建失败"
  exit 1
fi

# 4. 验证 Storybook (web)
echo "📚 验证 Storybook (web)..."
pnpm --filter @ai-voice/web build-storybook
if [ -d "apps/web/storybook-static" ]; then
  echo "✅ Storybook (web) 构建成功"
else
  echo "❌ Storybook (web) 构建失败"
  exit 1
fi

# 5. 验证 MkDocs (agents)
echo "📚 验证 MkDocs (agents)..."
cd agents
uv run --group docs mkdocs build
if [ -d "site" ]; then
  echo "✅ MkDocs (agents) 构建成功"
else
  echo "❌ MkDocs (agents) 构建失败"
  exit 1
fi
cd ..

echo ""
echo "🎉 所有文档工具验证成功！"
echo ""
echo "📦 产物位置："
echo "  - apps/api-server/docs/typedoc/"
echo "  - packages/shared/docs/typedoc/"
echo "  - apps/api-server/docs/compodoc/"
echo "  - apps/web/storybook-static/"
echo "  - agents/site/"
