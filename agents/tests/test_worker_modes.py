"""Worker 五种模式分发逻辑测试。

验证 AgentWorker.handle_request 根据 mode 参数正确分发到对应执行器:
  - exec: AgentRunner.run (ReAct 单智能体)
  - plan: PlanExecutor.execute (Plan-Act-Reflect)
  - multi: MultiAgentOrchestrator.execute (多智能体编排)
  - skills: get_skill_by_id → AgentRunner.run (技能模式,含回退)
  - mcp: McpClientManager → AgentRunner.run (MCP 工具模式,含清理)

所有外部依赖(Redis / LLM / 向量存储)均通过 mock 隔离。
"""
from unittest.mock import patch, AsyncMock, MagicMock

import pytest

from worker import AgentWorker


async def _empty_gen():
    """空异步生成器。"""
    if False:
        yield


@pytest.fixture(autouse=True)
def _mock_deps():
    """全局 mock:Redis / 记忆系统 / AgentRunner / PlanExecutor / Orchestrator。"""
    with (
        patch("worker.Redis") as mock_redis,
        patch("worker.LangchainOllamaEmbeddingProvider"),
        patch("worker.QdrantVectorStore"),
        patch("worker.MemoryManager") as mock_mem_cls,
        patch("worker.AgentRunner") as mock_runner_cls,
        patch("worker.PlanExecutor") as mock_plan,
        patch("worker.DeepAgentOrchestrator") as mock_orch,
    ):
        # Redis.from_url 返回 AsyncMock(支持 await rpush/expire)
        redis_inst = AsyncMock()
        mock_redis.from_url.return_value = redis_inst

        # MemoryManager() 是同步构造,返回 MagicMock(其异步方法自动为 AsyncMock)
        mem_inst = MagicMock()
        mem_inst.connect = AsyncMock()
        mem_inst.finish_turn = AsyncMock()
        mock_mem_cls.return_value = mem_inst

        # runner 实例的 run 方法返回空异步生成器
        runner_inst = MagicMock()
        runner_inst.run.return_value = _empty_gen()
        mock_runner_cls.return_value = runner_inst

        # plan / multi 执行器的 execute 返回空异步生成器
        plan_inst = MagicMock()
        plan_inst.execute.return_value = _empty_gen()
        mock_plan.return_value = plan_inst

        orch_inst = MagicMock()
        orch_inst.execute.return_value = _empty_gen()
        mock_orch.return_value = orch_inst

        yield {
            "redis": mock_redis,
            "redis_inst": redis_inst,
            "mem": mem_inst,
            "runner_cls": mock_runner_cls,
            "runner": runner_inst,
            "plan": mock_plan,
            "plan_inst": plan_inst,
            "orch": mock_orch,
            "orch_inst": orch_inst,
        }


@pytest.fixture
def worker():
    """创建测试用 AgentWorker 实例(所有外部依赖已 mock)。"""
    return AgentWorker()


def _base_msg(**overrides):
    """构造基础请求消息,可覆盖任意字段。"""
    msg = {
        "session_id": "test-session",
        "content": "hello",
        "mode": "exec",
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.7,
        "images": [],
        "history": [],
        "api_key": "sk-test",
        "base_url": None,
    }
    msg.update(overrides)
    return msg


# ── exec 模式 ─────────────────────────────────────────────────────────────


async def test_exec_mode_calls_runner(worker, _mock_deps):
    """exec 模式应通过 AgentRunner.run 处理请求。"""
    m = _mock_deps
    await worker.handle_request(_base_msg())
    m["runner_cls"].assert_called_once_with(
        model_provider="openai",
        model_name="gpt-4o",
        tool_names=None,
        tools=None,
        temperature=0.7,
        memory_manager=m["mem"],
        api_key="sk-test",
        base_url=None,
    )
    m["runner"].run.assert_called_once_with(
        "test-session", "hello", [], images=[],
    )


async def test_exec_mode_default_when_mode_absent(worker, _mock_deps):
    """未指定 mode 时默认 exec 模式。"""
    m = _mock_deps
    await worker.handle_request(_base_msg(mode=""))
    # mode="" 在 handle_request 中被 message.get("mode", "exec") 提取
    # 空字符串不是 "multi"/"plan"/"skills"/"mcp",走 else 分支(exec)
    m["runner"].run.assert_called_once()


# ── plan 模式 ─────────────────────────────────────────────────────────────


async def test_plan_mode_calls_plan_executor(worker, _mock_deps):
    """plan 模式应通过 PlanExecutor.execute 处理请求。"""
    m = _mock_deps
    await worker.handle_request(_base_msg(mode="plan"))
    m["runner_cls"].assert_called_once()
    m["plan"].assert_called_once_with(m["runner"])
    m["plan_inst"].execute.assert_called_once_with(
        "test-session", "hello", [],
    )


# ── multi 模式 ────────────────────────────────────────────────────────────


async def test_multi_mode_calls_orchestrator(worker, _mock_deps):
    """multi 模式应通过 MultiAgentOrchestrator.execute 处理请求。"""
    m = _mock_deps
    await worker.handle_request(_base_msg(mode="multi"))
    m["runner_cls"].assert_called_once()
    m["orch"].assert_called_once_with(m["runner"])
    m["orch_inst"].execute.assert_called_once_with(
        "test-session", "hello", [],
    )


# ── skills 模式 ───────────────────────────────────────────────────────────


@patch("worker.get_skill_by_id")
async def test_skills_mode_found(mock_get_skill, worker, _mock_deps):
    """skills 模式找到技能时,应使用技能的 tool_names 和 system_prompt。"""
    from types import SimpleNamespace

    skill = SimpleNamespace(
        id="code-review",
        tool_names=["calculator"],
        system_prompt="Review code carefully",
    )
    mock_get_skill.return_value = skill

    await worker.handle_request(_base_msg(mode="skills", skill="code-review"))

    mock_get_skill.assert_called_once_with("code-review")
    m = _mock_deps
    m["runner_cls"].assert_called_once_with(
        model_provider="openai",
        model_name="gpt-4o",
        tool_names=["calculator"],
        tools=None,
        temperature=0.7,
        memory_manager=m["mem"],
        api_key="sk-test",
        base_url=None,
    )
    m["runner"].run.assert_called_once_with(
        "test-session",
        "hello",
        [],
        images=[],
        system_prompt="Review code carefully",
    )


@patch("worker.get_skill_by_id")
async def test_skills_mode_not_found_fallback(mock_get_skill, worker, _mock_deps):
    """skills 模式技能未找到时,应回退到 exec 模式(无 tool_names/system_prompt)。"""
    mock_get_skill.return_value = None

    await worker.handle_request(_base_msg(mode="skills", skill="nonexistent"))

    m = _mock_deps
    # 回退后 runner 不含 tool_names,run 不含 system_prompt
    m["runner_cls"].assert_called_once_with(
        model_provider="openai",
        model_name="gpt-4o",
        tool_names=None,
        tools=None,
        temperature=0.7,
        memory_manager=m["mem"],
        api_key="sk-test",
        base_url=None,
    )
    m["runner"].run.assert_called_once_with(
        "test-session", "hello", [], images=[],
    )


# ── mcp 模式 ──────────────────────────────────────────────────────────────


@patch("worker.McpClientManager")
async def test_mcp_mode_connect_and_discover(mock_mcp_cls, worker, _mock_deps):
    """mcp 模式应连接 MCP 服务器、发现工具并注入 runner。"""
    mcp_inst = AsyncMock()
    mcp_inst.discover_tools.return_value = ["tool1", "tool2"]
    mock_mcp_cls.return_value = mcp_inst

    servers = [{"url": "http://localhost:3000"}]
    await worker.handle_request(_base_msg(mode="mcp", mcp_servers=servers))

    mcp_inst.connect_all.assert_called_once_with(servers)
    mcp_inst.discover_tools.assert_called_once()

    m = _mock_deps
    m["runner_cls"].assert_called_once_with(
        model_provider="openai",
        model_name="gpt-4o",
        tool_names=None,
        tools=["tool1", "tool2"],
        temperature=0.7,
        memory_manager=m["mem"],
        api_key="sk-test",
        base_url=None,
    )
    # 流消费完毕后 MCP 连接应已关闭
    mcp_inst.close.assert_called_once()


@patch("worker.McpClientManager")
async def test_mcp_mode_close_on_connect_failure(mock_mcp_cls, worker, _mock_deps):
    """mcp 模式连接失败时应关闭管理器并抛出异常。"""
    mcp_inst = AsyncMock()
    mcp_inst.connect_all.side_effect = ConnectionError("MCP server unreachable")
    mock_mcp_cls.return_value = mcp_inst

    await worker.handle_request(
        _base_msg(mode="mcp", mcp_servers=[{"url": "bad"}]),
    )

    mcp_inst.close.assert_called_once()
    # 连接失败后不应尝试发现工具
    mcp_inst.discover_tools.assert_not_called()
    # 错误信号应推送到 Redis
    _mock_deps["redis_inst"].rpush.assert_called()


@patch("worker.McpClientManager")
async def test_mcp_stream_yields_chunks(mock_mcp_cls, worker, _mock_deps):
    """mcp 模式应正确流式输出 chunk 并在结束后关闭连接。"""
    mcp_inst = AsyncMock()
    mcp_inst.discover_tools.return_value = ["t1"]
    mock_mcp_cls.return_value = mcp_inst

    # 让 runner.run 返回包含 chunk 的异步生成器
    import json

    async def _fake_run(*args, **kwargs):
        yield json.dumps({"type": "token", "content": "mcp-"})
        yield json.dumps({"type": "token", "content": "result"})

    _mock_deps["runner"].run.side_effect = _fake_run

    await worker.handle_request(_base_msg(mode="mcp", mcp_servers=[{"url": "ok"}]))

    # 两个 chunk 各推送一次,加上 done 相关的 expire 调用
    rpush_calls = _mock_deps["redis_inst"].rpush.call_args_list
    pushed_chunks = [call.args[1] for call in rpush_calls]
    assert any("mcp-" in c for c in pushed_chunks)
    assert any("result" in c for c in pushed_chunks)
    mcp_inst.close.assert_called_once()


# ── 响应推送 ──────────────────────────────────────────────────────────────


async def test_response_pushed_to_redis(worker, _mock_deps):
    """chunk 应通过 rpush 推送到正确的 Redis 响应列表。"""
    import json

    async def _fake_run(*args, **kwargs):
        yield json.dumps({"type": "token", "content": "hi"})

    _mock_deps["runner"].run.side_effect = _fake_run

    await worker.handle_request(_base_msg())

    rpush_calls = _mock_deps["redis_inst"].rpush.call_args_list
    # 至少有一次 rpush 推送到 agent:response:list:test-session
    target = "agent:response:list:test-session"
    assert any(c.args[0] == target for c in rpush_calls)


# ── 错误处理 ──────────────────────────────────────────────────────────────


async def test_error_pushes_error_and_done(worker, _mock_deps):
    """执行器抛出异常时,应推送 error + done 信号到 Redis。"""

    async def _failing(*args, **kwargs):
        if False:
            yield
        raise RuntimeError("LLM down")

    _mock_deps["runner"].run.side_effect = _failing

    await worker.handle_request(_base_msg())

    rpush_calls = _mock_deps["redis_inst"].rpush.call_args_list
    pushed = [c.args[1] for c in rpush_calls]
    assert any('"error"' in p for p in pushed)
    assert any('"done"' in p for p in pushed)


async def test_cancelled_pushes_done(worker, _mock_deps):
    """任务被取消时,应推送 done 信号到 Redis。"""
    import asyncio

    async def _blocking(*args, **kwargs):
        await asyncio.sleep(100)
        if False:
            yield

    _mock_deps["runner"].run.side_effect = _blocking

    task = asyncio.create_task(worker.handle_request(_base_msg()))
    await asyncio.sleep(0)
    task.cancel()
    await task

    rpush_calls = _mock_deps["redis_inst"].rpush.call_args_list
    pushed = [c.args[1] for c in rpush_calls]
    assert any('"done"' in p for p in pushed)


# ── 记忆集成 ──────────────────────────────────────────────────────────────


async def test_memory_records_user_and_assistant(worker, _mock_deps):
    """handle_request 应将用户消息和助手回复记录到短期记忆。"""
    import json

    async def _fake_run(*args, **kwargs):
        yield json.dumps({"type": "token", "content": "hello "})
        yield json.dumps({"type": "token", "content": "world"})

    _mock_deps["runner"].run.side_effect = _fake_run

    await worker.handle_request(_base_msg(content="hi there"))

    # add_turn 至少被调用两次:user 消息 + assistant 回复
    add_turn_calls = worker.memory.add_turn.call_args_list
    assert len(add_turn_calls) >= 2
    # 第一次:user 消息
    assert add_turn_calls[0].args == ("test-session", "user", "hi there")
    # 第二次:assistant 回复(累积的 token)
    assert add_turn_calls[1].args == ("test-session", "assistant", "hello world")


async def test_finish_turn_called_with_api_key(worker, _mock_deps):
    """handle_request 结束时应调用 finish_turn 并传入 api_key。"""
    await worker.handle_request(_base_msg(content="test", api_key="sk-123"))

    worker.memory.finish_turn.assert_called_once_with(
        "test-session", "test", "", api_key="sk-123",
    )
