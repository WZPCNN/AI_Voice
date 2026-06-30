"""端到端测试 — 验证完整请求-响应流程。

测试环境要求：
  - Redis 服务运行（localhost:6379）
  - DeepSeek API 可用（通过 .env 配置）
  - Qdrant 服务运行（可选，用于记忆系统）

测试覆盖：
  - exec 模式：完整 ReAct 流程
  - plan 模式：Plan-Act-Reflect 流程
  - skills 模式：技能调用
"""
import asyncio
import json
import os
import pytest
from redis.asyncio import Redis
from worker import AgentWorker
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY", "")
BASE_URL = os.getenv("BASE_URL", "")
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-chat")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


def _base_request(**overrides):
    """构造基础请求消息。"""
    req = {
        "session_id": "e2e-test",
        "content": "你好，请用一句话介绍自己",
        "mode": "exec",
        "provider": "openai",
        "model": MODEL_NAME,
        "temperature": 0.7,
        "images": [],
        "history": [],
        "api_key": API_KEY,
        "base_url": BASE_URL,
    }
    req.update(overrides)
    return req


async def _collect_chunks(worker, request, timeout=60):
    """调用 handle_request 并从 Redis 收集响应 chunks。"""
    response_key = f"agent:response:list:{request['session_id']}"
    redis = Redis.from_url(REDIS_URL, decode_responses=True)

    try:
        await redis.delete(response_key)

        # 启动 handle_request 作为后台任务
        task = asyncio.create_task(worker.handle_request(request))

        # 收集响应 chunks
        chunks = []
        deadline = asyncio.get_running_loop().time() + timeout

        while True:
            if asyncio.get_running_loop().time() > deadline:
                task.cancel()
                pytest.fail(f"响应超时（{timeout}秒）")

            result = await redis.blpop(response_key, timeout=2)
            if result is None:
                # 检查 task 是否已完成
                if task.done():
                    break
                continue

            _, raw = result
            try:
                chunk = json.loads(raw)
                chunks.append(chunk)
                if chunk.get("type") in ("done", "error"):
                    break
            except json.JSONDecodeError:
                continue

        # 等待 task 完成
        if not task.done():
            try:
                await asyncio.wait_for(task, timeout=5)
            except asyncio.TimeoutError:
                task.cancel()

        return chunks
    finally:
        await redis.delete(response_key)
        await redis.aclose()


@pytest.fixture
async def worker():
    """创建测试 Worker 实例。"""
    w = AgentWorker()
    await w.start()
    yield w


@pytest.mark.asyncio
async def test_e2e_exec_mode(worker):
    """端到端测试：exec 模式完整流程。"""
    chunks = await _collect_chunks(worker, _base_request())

    assert len(chunks) > 0, "未收到任何响应"

    # 检查是否有错误
    errors = [c for c in chunks if c.get("type") == "error"]
    assert len(errors) == 0, f"收到错误：{errors}"

    # 验证有 token 响应
    tokens = [c for c in chunks if c.get("type") == "token"]
    assert len(tokens) > 0, "未收到任何 token 响应"

    full_response = "".join(t.get("content", "") for t in tokens)
    assert len(full_response) > 0, "响应内容为空"

    print(f"\n[exec 模式] 响应长度：{len(full_response)} 字符")
    print(f"[exec 模式] 前 100 字：{full_response[:100]}...")


@pytest.mark.asyncio
async def test_e2e_plan_mode(worker):
    """端到端测试：plan 模式完整流程。"""
    request = _base_request(
        session_id="e2e-test-plan",
        content="请帮我分析 Python 异步编程的优缺点",
        mode="plan",
    )
    chunks = await _collect_chunks(worker, request, timeout=90)

    assert len(chunks) > 0, "未收到任何响应"

    errors = [c for c in chunks if c.get("type") == "error"]
    assert len(errors) == 0, f"收到错误：{errors}"

    tokens = [c for c in chunks if c.get("type") == "token"]
    assert len(tokens) > 0, "未收到任何 token 响应"

    full_response = "".join(t.get("content", "") for t in tokens)
    assert len(full_response) > 0, "响应内容为空"

    print(f"\n[plan 模式] 响应长度：{len(full_response)} 字符")
    print(f"[plan 模式] 前 100 字：{full_response[:100]}...")


@pytest.mark.asyncio
async def test_e2e_skills_mode(worker):
    """端到端测试：skills 模式完整流程。"""
    request = _base_request(
        session_id="e2e-test-skills",
        content="请帮我审查这段代码：def add(a, b): return a + b",
        mode="skills",
        skill="code-review",
    )
    chunks = await _collect_chunks(worker, request)

    assert len(chunks) > 0, "未收到任何响应"

    errors = [c for c in chunks if c.get("type") == "error"]
    assert len(errors) == 0, f"收到错误：{errors}"

    tokens = [c for c in chunks if c.get("type") == "token"]
    assert len(tokens) > 0, "未收到任何 token 响应"

    full_response = "".join(t.get("content", "") for t in tokens)
    assert len(full_response) > 0, "响应内容为空"

    print(f"\n[skills 模式] 响应长度：{len(full_response)} 字符")
    print(f"[skills 模式] 前 100 字：{full_response[:100]}...")
