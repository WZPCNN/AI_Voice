"""Plan-Act-Reflect 执行器 — api_key 从 runner 向下传递。

工作流程:
  1. Plan:用 TaskDecomposer 将任务分解为多个步骤
  2. Act:对每个步骤用 ReAct Agent(runner.run)执行
  3. Reflect:全部步骤完成后,LLM 基于所有步骤结果生成最终总结

本执行器同时被 multi 模式的子智能体复用(传入 system_prompt 进行角色约束)。
"""
# asyncio — 标准库,用于异步 sleep
import asyncio
# json — 标准库,用于 chunk 序列化
import json
# AsyncIterator — 异步迭代器类型注解
from collections.abc import AsyncIterator
# TaskDecomposer — 任务分解器
from decomposer import TaskDecomposer
# AgentRunner — ReAct Agent 运行器
from runner import AgentRunner
# get_logger — structlog 结构化日志(替代裸 print)
from logger import get_logger

# ── 模块级 logger ──────────────────────────────────────────────────────────
# 全局 logger 实例,绑定模块名 __name__,供本文件所有日志调用使用
logger = get_logger(__name__)

# ── 常量配置 ──────────────────────────────────────────────────────────────
# 总结类步骤关键词 — 若计划最后一步包含这些词,会被移除(避免重复总结)
# 因为执行器会在所有步骤完成后自动生成总结
SUMMARY_KEYWORDS = ["总结", "汇总", "最终回答", "给出答案", "summarize", "final answer", "conclusion"]
# 步骤间延迟(秒)— 给前端留出渲染时间,避免步骤切换过快
STEP_DELAY = 1.0


class PlanExecutor:
    """生成计划,然后用 ReAct Agent 逐步执行。

    decomposer 使用的 ``api_key`` / ``base_url`` 继承自 runner,
    确保数据库配置的凭据优先级高于环境变量。
    """

    def __init__(self, runner: AgentRunner) -> None:
        """初始化。

        Args:
            runner: ReAct Agent 运行器(提供 LLM 和凭据)
        """
        # 创建任务分解器,复用 runner 的凭据
        self.decomposer = TaskDecomposer(
            runner.model_provider,
            runner.model_name,
            api_key=runner.api_key,
            base_url=runner.base_url,
        )
        self.runner = runner

    async def execute(
        self, session_id: str, task: str, history: list[dict] | None = None,
        system_prompt: str | None = None,
    ) -> AsyncIterator[str]:
        """执行 Plan-Act-Reflect 流程,流式输出 chunk。

        chunk 类型:
          - {"type": "plan", "steps": [...]} — 计划生成完毕
          - {"type": "step_start", "index": N, "step": "..."} — 步骤开始
          - {"type": "token", "content": "..."} — LLM 输出 token
          - {"type": "step_complete", "index": N} — 步骤完成
          - {"type": "done"} — 全部完成

        Args:
            session_id: 会话 ID
            task: 待执行的任务
            history: 历史对话(子智能体模式下传 None,避免越界)
            system_prompt: 自定义系统提示词(子智能体角色约束)
        Yields:
            str: JSON chunk
        """
        logger.info("executing_plan_mode", task_preview=task[:80], system_prompt_mode='custom' if system_prompt else 'default')
        # ── 阶段1:Plan — 分解任务 ─────────────────────────────────────
        plan = await self.decomposer.decompose(task)

        # 过滤掉总结类最后一步(避免与执行器自动总结重复)
        if len(plan) > 1:
            last_step = plan[-1]["step"].lower()
            if any(kw in last_step for kw in SUMMARY_KEYWORDS):
                logger.info("removing_summary_step", step=plan[-1]['step'])
                plan = plan[:-1]

        logger.info("plan_created", steps_count=len(plan), steps=[s['step'] for s in plan])
        # 向前端推送计划
        yield json.dumps({"type": "plan", "steps": plan}) + "\n"

        # 收集每步输出,用于最终总结
        step_outputs: list[str] = []

        # ── 阶段2:Act — 逐步执行 ──────────────────────────────────────
        for i, step in enumerate(plan):
            logger.info("step_start_executing", step_index=i+1, steps_total=len(plan), step=step['step'])
            try:
                # 通知前端:步骤开始
                yield json.dumps({"type": "step_start", "index": i, "step": step["step"]}) + "\n"
                logger.info("step_prompt", step_index=i+1, prompt_preview=step['step'][:80])
                # 构造步骤执行提示词
                # 强调"专注当前子任务",避免 LLM 越界回答原问题
                step_prompt = (
                    f"DIRECT EXECUTION — you are a specialist handling ONE specific sub-task, not the user's original request.\n"
                    f"Produce only the final output; no questions, no confirmation requests.\n\n"
                    f"Current step: {step['step']}\n"
                    f"Step context: {step.get('details', '')}\n\n"
                    f"CRITICAL: Only answer the 'Current step' above. Do NOT answer the user's original question or any other task.\n\n"
                    f"Output:"
                )
                step_result = ""
                # 调用 runner 执行单步(流式输出 token)
                async for chunk in self.runner.run(session_id, step_prompt, history, system_prompt=system_prompt):
                    d = json.loads(chunk)
                    # 过滤掉 runner 的 done 信号(执行器自己控制 done)
                    if d.get("type") == "done":
                        continue
                    # 累积 step 结果文本
                    if d.get("type") == "token" and d.get("content"):
                        step_result += d["content"]
                    # 透传 chunk 给前端
                    yield chunk
                # 通知前端:步骤完成
                yield json.dumps({"type": "step_complete", "index": i}) + "\n"
                # 步骤间延迟
                await asyncio.sleep(STEP_DELAY)
                step_outputs.append(f"Step {i+1}: {step['step']}\nResult: {step_result.strip()}")
            except Exception as exc:
                # 单步失败不中断整体流程
                logger.error("step_failed", step=i+1, error=str(exc), exc_info=True)
                yield json.dumps({"type": "step_complete", "index": i, "error": str(exc)}) + "\n"
                await asyncio.sleep(STEP_DELAY)
                step_outputs.append(f"Step {i+1}: {step['step']}\nResult: FAILED — {str(exc)}")

        # ── 阶段3:Reflect — 生成最终总结 ─────────────────────────────
        if step_outputs:
            summary_prompt = (
                "你已完成了以下多个步骤的任务，请根据所有步骤的结果，给出一个完整、清晰的最终回答。用中文回复。\n\n"
                + "\n\n".join(step_outputs)
                + f"\n\n原始任务: {task}\n\n最终回答:"
            )
            logger.info("generating_final_summary")
            # 调用 runner 生成总结(流式输出)
            async for chunk in self.runner.run(session_id, summary_prompt, history, system_prompt=system_prompt):
                d = json.loads(chunk)
                if d.get("type") == "done":
                    continue
                yield chunk

        # 全部完成
        yield json.dumps({"type": "done"}) + "\n"
