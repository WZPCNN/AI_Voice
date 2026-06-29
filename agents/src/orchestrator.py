"""混合多智能体编排器 — 分层委托。

工作流程:
  CEO(Coordinator)分析任务
  -> 拆分为多个功能区域(areas),并指定依赖关系(deps)
  -> 委托给子智能体执行(根据 deps 决定串行或并行)
  -> 子智能体可继续拆分(深度 1 -> 2)
  -> CEO 汇总所有结果,生成最终报告

关键设计:
  - 拓扑排序:根据 deps 将 areas 分为多个 wave,无依赖的并行执行
  - 角色约束:PromptArchitect 为每个子智能体生成专属 system_prompt + constraint_prompt
  - 上下文传递:子智能体可读取上游依赖的输出(截断到 CONTEXT_TRUNCATE 字符)
  - 递归深度限制:MAX_DEPTH=2,防止无限递归
"""
# asyncio — 标准库,用于并行任务和队列
import asyncio
# json — 标准库,chunk 序列化
import json
# re — 标准库,正则表达式(用于语义重叠检测)
import re
# AsyncIterator — 异步迭代器类型注解
from typing import AsyncIterator
# AgentRunner — ReAct Agent 运行器
from runner import AgentRunner
# PlanExecutor — 计划执行器(子智能体复用)
from executor import PlanExecutor
# PromptArchitect — 提示词架构师(为子智能体生成专属提示词)
from prompt_architect import PromptArchitect
# extract_json — 容错 JSON 提取
from json_utils import extract_json
# get_logger — structlog 结构化日志(替代裸 print)
from logger import get_logger

# ── 模块级 logger ──────────────────────────────────────────────────────────
# 全局 logger 实例,绑定模块名 __name__,供本文件所有日志调用使用
logger = get_logger(__name__)


class MultiAgentOrchestrator:
    """混合串行/并行编排器,支持递归委托。

    Attributes:
        MAX_AGENTS: 单层最大子智能体数(防止过度拆分)
        MAX_DEPTH: 最大递归深度(CEO=0, 子智能体=1, 孙智能体=2)
    """

    MAX_AGENTS = 5
    MAX_DEPTH = 2

    def __init__(self, runner: AgentRunner) -> None:
        """初始化。

        Args:
            runner: ReAct Agent 运行器(提供 LLM 和凭据)
        """
        self.runner = runner
        # 创建提示词架构师,复用 runner 凭据
        self.architect = PromptArchitect(
            runner.model_provider,
            runner.model_name,
            api_key=runner.api_key,
            base_url=runner.base_url,
        )

    # ── 主入口 ──────────────────────────────────────────────────────────
    async def execute(
        self, session_id: str, task: str, history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """主入口:从 CEO(depth=0)开始委托。

        Args:
            session_id: 会话 ID
            task: 用户任务
            history: 历史对话
        Yields:
            str: JSON chunk
        """
        # 从 depth=0(Coordinator)开始递归委托
        async for chunk in self._delegate(
            session_id, task, history, depth=0, agent_name="Coordinator",
        ):
            yield chunk
        # 最终结束信号
        yield json.dumps({"type": "done"}) + "\n"

    # ── 核心委托逻辑 ────────────────────────────────────────────────────
    async def _delegate(
        self, session_id: str, task: str, history: list[dict] | None,
        depth: int, agent_name: str, area: dict | None = None,
    ) -> AsyncIterator[str]:
        """递归委托:CEO 拆分,子智能体直接执行。

        Args:
            session_id: 会话 ID
            task: 当前层级的任务
            history: 历史对话(仅 CEO 使用,子智能体传 None)
            depth: 递归深度(0=CEO, 1=子智能体, 2=孙智能体)
            agent_name: 当前智能体名称
            area: 当前区域信息(含 system_prompt、constraint_prompt),CEO 为 None
        Yields:
            str: JSON chunk
        """
        # ── 子智能体(depth >= 1):直接执行,不再拆分 ──────────────────
        if depth >= 1:
            # 每个子智能体使用独立的 session_id,隔离 langgraph 检查点状态
            sub_session_id = f"{session_id}_{agent_name}"
            # 通知前端:智能体开始
            yield _ev("agent_start", agent=agent_name, name=agent_name, color=self._color(agent_name))
            # 获取 system_prompt(来自 PromptArchitect 设计)
            sys_prompt = (area or {}).get("system_prompt", "") or None
            # 附加 constraint_prompt(强制约束)
            constraint = (area or {}).get("constraint_prompt", "")
            if constraint:
                if sys_prompt:
                    sys_prompt = sys_prompt + "\n\n" + constraint
                else:
                    sys_prompt = constraint
            # 创建计划执行器(子智能体复用 Plan-Act-Reflect 流程)
            executor = PlanExecutor(self.runner)
            # 子智能体不接收原始历史(避免越界)
            async for chunk in executor.execute(sub_session_id, task, None, system_prompt=sys_prompt):
                d = json.loads(chunk)
                # 过滤掉 executor 的 done(由本函数控制)
                if d.get("type") == "done":
                    continue
                # 为所有事件附加 agent 字段,前端据此区分智能体
                d["agent"] = agent_name
                yield json.dumps(d) + "\n"
            # 通知前端:智能体结束
            yield _ev("agent_end", agent=agent_name)
            return

        # ── CEO(depth == 0):分析任务,决定是否拆分 ────────────────────
        areas, deps = await self._analyse(task, depth)

        # ── 为所有区域设计角色提示词 ──────────────────────────────────
        if areas:
            areas, validation_issues = await self._design_and_validate(areas, depth)
            if validation_issues:
                for issue in validation_issues:
                    logger.warning("validation_issue", depth=depth, issue=issue)
                # 若所有区域 system_prompt 相同,说明拆分无效,放弃拆分
                unique_prompts = {a.get("system_prompt", "") for a in areas}
                if len(unique_prompts) <= 1 and len(areas) > 1:
                    logger.warning("all_prompts_identical_fallback", depth=depth)
                    areas = []

        # ── 无区域:直接执行(不拆分) ─────────────────────────────────
        if not areas:
            yield _ev("agent_start", agent=agent_name, name=agent_name,
                      color=self._color(agent_name))
            # 调用 runner 直接执行(ReAct 模式)
            async for chunk in self.runner.run(session_id, task, history):
                d = json.loads(chunk)
                if d.get("type") == "done":
                    continue
                # 为 token 事件附加 agent 字段
                if d.get("type") == "token" and d.get("content"):
                    d["agent"] = agent_name
                yield json.dumps(d) + "\n"
            yield _ev("agent_end", agent=agent_name)
            return

        logger.info("delegation_plan", depth=depth, agent=agent_name, areas_count=len(areas), deps_count=len(deps))

        # ── 顶层:推送计划给前端 ──────────────────────────────────────
        if depth == 0:
            plan_steps = [{"step": a["description"], "assignee": a["name"]} for a in areas]
            yield _ev("plan", steps=plan_steps)

        # ── 拓扑排序:将 areas 分为多个 wave ─────────────────────────
        # 无依赖的 areas 在同一 wave,可并行执行
        n = len(areas)
        # name -> index 映射
        name_to_idx = {a["name"]: i for i, a in enumerate(areas)}
        # 入度数组(每个节点有多少前置依赖)
        in_degree = [0] * n
        # 邻接表:graph[frm] = [to1, to2, ...]
        graph = [[] for _ in range(n)]
        # 构建图
        for frm_name, to_name in deps:
            frm = name_to_idx.get(frm_name, -1)
            to = name_to_idx.get(to_name, -1)
            if 0 <= frm < n and 0 <= to < n and frm != to:
                graph[frm].append(to)
                in_degree[to] += 1

        # Kahn 算法:按入度为 0 的节点逐层剥离
        waves = []
        # 初始:所有入度为 0 的节点
        ready = [i for i in range(n) if in_degree[i] == 0]
        while ready:
            waves.append(sorted(ready))  # 排序保证执行顺序稳定
            next_ready = []
            for u in ready:
                for v in graph[u]:
                    in_degree[v] -= 1
                    if in_degree[v] == 0:
                        next_ready.append(v)
            ready = next_ready

        # ── 逐 wave 执行 ─────────────────────────────────────────────
        # results: 子智能体名 -> 输出文本
        results: dict[str, str] = {}

        for wave in waves:
            if len(wave) == 1:
                # ── 串行执行(单节点 wave) ───────────────────────────
                idx = wave[0]
                area = areas[idx]
                sub_name = area["name"]
                sub_task = area["description"]

                # 获取上游依赖的输出作为上下文
                ctx = self._upstream(area, deps, areas, results)
                if ctx:
                    sub_task = f"{sub_task}\n\n前置依赖结果:{ctx}"

                logger.info("serial_execution", depth=depth, sub_name=sub_name)
                res_text = ""
                # 递归委托(深度+1)
                async for chunk in self._delegate(
                    session_id, sub_task, history, depth + 1, sub_name, area,
                ):
                    yield chunk
                    try:
                        d = json.loads(chunk)
                        if d.get("type") == "token" and d.get("content"):
                            res_text += d["content"]
                    except Exception:
                        pass
                results[sub_name] = res_text

            else:
                # ── 并行执行(多节点 wave) ────────────────────────────
                batch = [areas[i] for i in wave]
                names = [a["name"] for a in batch]
                logger.info("parallel_execution", depth=depth, names=names)

                # 先推送所有 agent_start / step_start 事件
                for a in batch:
                    idx = areas.index(a)
                    yield _ev("agent_start", agent=a["name"], name=a["name"],
                              color=a.get("color", "#6366F1"))
                    yield _ev("step_start", index=idx, step=a["description"], agent=a["name"])

                # 异步队列:收集并行任务的输出事件
                queue: asyncio.Queue[dict] = asyncio.Queue()

                async def run_one(area: dict):
                    """单个并行子任务的执行协程。"""
                    sub_name = area["name"]
                    sub_task = area["description"]
                    # 获取上游依赖输出
                    ctx = self._upstream(area, deps, areas, results)
                    if ctx:
                        sub_task = f"{sub_task}\n\n前置依赖结果:{ctx}"
                    res_text = ""
                    # 递归委托
                    async for chunk in self._delegate(
                        session_id, sub_task, history, depth + 1, sub_name, area,
                    ):
                        d = json.loads(chunk)
                        if d.get("type") == "token" and d.get("content"):
                            res_text += d["content"]
                        # 将事件放入队列(由主循环消费并 yield)
                        await queue.put(d)
                    return (sub_name, res_text)

                # 启动所有并行任务
                tasks = [asyncio.create_task(run_one(a)) for a in batch]
                done = 0
                # 主循环:从队列消费事件并 yield,直到所有任务完成
                while done < len(tasks):
                    try:
                        # 0.5 秒超时,避免永久阻塞
                        d = await asyncio.wait_for(queue.get(), timeout=0.5)
                        yield json.dumps(d) + "\n"
                    except asyncio.TimeoutError:
                        # 超时时检查已完成任务数
                        done = sum(1 for t in tasks if t.done())

                # 推送所有 agent_end / step_complete 事件
                for a in batch:
                    idx = areas.index(a)
                    yield _ev("step_complete", index=idx, agent=a["name"])
                    yield _ev("agent_end", agent=a["name"])

                # 收集并行任务的结果
                for t in tasks:
                    try:
                        name, text = t.result()
                        results[name] = text
                    except Exception as exc:
                        logger.error("parallel_task_failed", depth=depth, error=str(exc), exc_info=True)

        # ── 汇总:CEO 生成最终报告 ────────────────────────────────────
        if depth == 0 and results:
            # 使用独立 session_id,避免污染 CEO 的对话状态
            summary_session_id = f"{session_id}_summary"
            # 构造汇总提示词
            summary = self._summary(task, areas, results)
            logger.info("summary_start", depth=depth, summary_length=len(summary))
            # Coordinator 智能体开始
            yield _ev("agent_start", agent="Coordinator", name="Coordinator",
                      color="#8B5CF6")
            # 调用 runner 生成最终报告(流式输出)
            async for chunk in self.runner.run(summary_session_id, summary, history):
                d = json.loads(chunk)
                if d.get("type") == "done":
                    continue
                yield json.dumps(d) + "\n"
            yield _ev("agent_end", agent="Coordinator")

    # ── 任务分析 ────────────────────────────────────────────────────────
    async def _analyse(
        self, task: str, depth: int,
    ) -> tuple[list[dict], list[tuple[str, str]]]:
        """分析任务,返回 (areas, deps),不含 system_prompt。

        system_prompt 由后续的 _design_and_validate 生成。

        Args:
            task: 待分析的任务
            depth: 当前深度

        Returns:
            tuple: (areas 列表, deps 列表)
                  areas 为空列表表示不拆分,直接执行
        """
        # 构造分析提示词
        prompt = (
            "你是任务拆解专家。分析任务，判断是否可拆分为多个独立子任务：\n\n"
            "拆分原则：\n"
            "1. 如果任务包含多个完全独立、互不依赖的子任务（如翻译成多种语言、搜索多个独立主题），拆分为独立模块，deps留空[]（并行）。\n"
            "2. 只有子任务之间存在明确的先后依赖关系时，才添加deps（串行）。\n"
            "3. description务必具体完整，包含该子任务需要完成的完整内容，不要依赖上下文或隐含信息。\n"
            "4. description中禁止提及「原任务」「原始问题」「用户需求」等暗示存在更大任务的词汇——每个子任务的描述必须自包含。\n"
            "5. name使用2-4个中文字，简洁描述该子任务的领域方向。\n\n"
            "返回纯JSON（不要markdown）：\n"
            '{"areas":[{"name":"子任务名(2-4中文字)","description":"子任务完整描述"}],'
            '"deps":[["上游名","下游名"]]}\n\n'
            f"任务: {task}"
        )
        try:
            # 30 秒超时,防止 LLM 挂起阻塞编排器
            resp = await asyncio.wait_for(
                self.runner.llm.ainvoke([{"role": "user", "content": prompt}]),
                timeout=30.0,
            )
            text = (resp.content or "").strip()
            # 从 LLM 输出提取 JSON
            data = extract_json(text)
            raw_areas = data.get("areas", [])
            raw_deps = data.get("deps", [])
            if isinstance(raw_areas, list) and len(raw_areas) > 0:
                logger.info("split_into_areas", depth=depth, areas_count=len(raw_areas), area_names=[a.get('name','?') for a in raw_areas])
                areas_out = []
                # 限制最大子智能体数(MAX_AGENTS * 2,留余量)
                for a in raw_areas[:self.MAX_AGENTS * 2]:
                    areas_out.append({
                        "name": str(a.get("name", "Agent")),
                        "description": str(a.get("description", a.get("desc", "Task"))),
                        "color": str(self._color(a.get("name", "Agent"))),
                    })
                # 校验:若仅 1 个区域且描述与原任务高度重合,拒绝拆分
                if len(areas_out) == 1:
                    desc = areas_out[0]["description"]
                    # 去除空白后比较,防止 LLM 仅微调措辞
                    task_stripped = task.replace(" ", "").replace("\n", "")
                    desc_stripped = desc.replace(" ", "").replace("\n", "")
                    # 70% 重叠或互相包含视为无效拆分
                    if len(desc_stripped) >= len(task_stripped) * 0.7 or task_stripped in desc_stripped or desc_stripped in task_stripped:
                        logger.warning("single_area_matches_task_rejected", depth=depth)
                        return ([], [])
                # 解析 deps
                deps_out = []
                for pair in raw_deps:
                    if isinstance(pair, list) and len(pair) == 2:
                        deps_out.append((str(pair[0]), str(pair[1])))
                return (areas_out, deps_out)
            else:
                logger.info("task_judged_simple", depth=depth)
        except Exception as exc:
            logger.error("analyse_exception", depth=depth, error=str(exc), exc_info=True)
        # 任何异常或无效结果都返回空(直接执行)
        return ([], [])

    async def _design_and_validate(
        self, areas: list[dict], depth: int,
    ) -> tuple[list[dict], list[str]]:
        """调用 PromptArchitect 为所有区域设计提示词,然后校验对齐性。

        Args:
            areas: 区域列表
            depth: 当前深度

        Returns:
            tuple: (enriched_areas, validation_issues)
                  enriched_areas 含 name、description、system_prompt、constraint_prompt、color
                  validation_issues 是问题字符串列表(空表示无问题)
        """
        logger.info("designing_role_prompts", depth=depth, areas_count=len(areas))
        # 调用 PromptArchitect 批量设计
        enriched = await self.architect.design_roles(areas)
        # 校验角色对齐性
        issues = self._validate_alignment(enriched)
        return enriched, issues

    def _validate_alignment(self, areas: list[dict]) -> list[str]:
        """校验区域名称、system_prompt、description 的对齐性和区分度。

        Args:
            areas: 区域列表

        Returns:
            list[str]: 问题字符串列表(空表示无问题)
        """
        issues: list[str] = []
        # 单区域无需校验
        if len(areas) <= 1:
            return issues

        # ── 检查1:名称唯一性 ──────────────────────────────────────────
        names = [a.get("name", "") for a in areas]
        if len(set(names)) != len(names):
            duplicates = {n for n in names if names.count(n) > 1}
            issues.append(f"Duplicate names: {duplicates}")

        # ── 检查2:system_prompt 不应引用其他区域名 ────────────────────
        sys_prompts = [a.get("system_prompt", "") for a in areas]
        for i, prompt in enumerate(sys_prompts):
            if not prompt:
                issues.append(f"Area {i} ({names[i]}) has empty system_prompt")
                continue
            # 检查是否提及其他区域名(暗示越界)
            for j, other_name in enumerate(names):
                if i != j and other_name and other_name in prompt:
                    issues.append(
                        f"Area {i} ({names[i]}) system_prompt references "
                        f"other area '{other_name}'"
                    )

        # ── 检查3:语义重叠(2-gram 词级相似度) ────────────────────────
        for i in range(len(sys_prompts)):
            for j in range(i + 1, len(sys_prompts)):
                if not sys_prompts[i] or not sys_prompts[j]:
                    continue
                # 中文 2-gram 分词(避免字符级 false positive)
                def tokens(s):
                    s = re.sub(r'\s+', '', s)
                    return {s[k:k+2] for k in range(len(s) - 1)}
                words_i = tokens(sys_prompts[i])
                words_j = tokens(sys_prompts[j])
                if words_i and words_j:
                    # 交集大小 / 较小集合大小
                    common = words_i & words_j
                    overlap_ratio = len(common) / min(len(words_i), len(words_j))
                    # 60% 以上重叠视为职责重叠
                    if overlap_ratio > 0.6:
                        issues.append(
                            f"Areas {i} ({names[i]}) and {j} ({names[j]}) "
                            f"have highly overlapping system_prompts "
                            f"(overlap={overlap_ratio:.0%})"
                        )

        return issues

    def _extract_json(self, text: str) -> dict:
        """从 LLM 输出提取 JSON(委托给共享工具)。"""
        return extract_json(text)

    # ── 辅助方法 ────────────────────────────────────────────────────────
    def _upstream(
        self, area: dict, deps: list[tuple[str, str]],
        areas: list[dict], results: dict[str, str],
    ) -> str:
        """获取当前区域的上游依赖输出,作为上下文。

        Args:
            area: 当前区域
            deps: 依赖列表
            areas: 所有区域
            results: 已完成区域的结果 {name: text}

        Returns:
            str: 拼接的上游上下文文本(可能为空)
        """
        ctx_parts = []
        for frm_name, to_name in deps:
            # 找到指向当前区域的依赖
            if to_name == area["name"] and frm_name in results and results[frm_name]:
                # 截断到 CONTEXT_TRUNCATE 字符,避免上下文过长
                ctx_parts.append(
                    f"[{frm_name}的输出]:\n{results[frm_name][-CONTEXT_TRUNCATE:]}"
                )
        return "\n".join(ctx_parts)

    def _summary(self, task: str, areas: list[dict], results: dict[str, str]) -> str:
        """构造最终汇总提示词。

        Args:
            task: 原始任务
            areas: 所有区域
            results: 各智能体的输出

        Returns:
            str: 汇总提示词
        """
        parts = [
            "根据各专家结果，用中文撰写"
            "完整统一的最终报告。Markdown格式。\n\n"
        ]
        # 拼接每个区域的任务和结果
        for a in areas:
            text = results.get(a["name"], "")
            if text:
                parts.append(
                    f"## {a['name']}\n**任务**: {a['description']}\n"
                    f"**结果**:\n{text[:RESULT_TRUNCATE]}\n\n---\n\n"
                )
        parts.append(f"原始任务: {task}\n\n最终报告:")
        return "".join(parts)



    @staticmethod
    def _color(name: str) -> str:
        """根据名称生成稳定的颜色(同一名称始终得到同一颜色)。

        Args:
            name: 智能体名称

        Returns:
            str: 颜色 hex 字符串,如 "#6366F1"
        """
        # 颜色池:8 种主题色
        colors = [
            "#6366F1", "#10B981", "#F59E0B", "#EF4444",
            "#8B5CF6", "#06B6D4", "#EC4899", "#F97316",
        ]
        # 用名称字符的 Unicode 码点之和取模,保证稳定性
        return colors[sum(ord(c) for c in name) % len(colors)]


def _ev(kind: str, **kw) -> str:
    """构造事件 chunk 的便捷函数。

    Args:
        kind: 事件类型,如 "agent_start"、"plan"、"step_start"
        **kw: 事件附加字段

    Returns:
        str: JSON 字符串(以 \\n 结尾)
    """
    return json.dumps({"type": kind, **kw}) + "\n"

# ── 截断常量 ──────────────────────────────────────────────────────────────
# 上游依赖上下文的最大字符数(避免上下文爆炸)
CONTEXT_TRUNCATE = 1500
# 汇总时每个智能体结果的最大字符数
RESULT_TRUNCATE = 2000
