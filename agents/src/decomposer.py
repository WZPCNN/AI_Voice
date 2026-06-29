"""任务分解器 — 基于 LLM 的计划生成,使用结构化输出。

将复杂任务拆分为 2~5 个原子步骤,每步是一个独立的可执行动作。
支持两种生成方式:
  1. function_calling(快速,OpenAI/Anthropic 原生支持)
  2. 纯 LLM + JSON 解析(兜底,兼容自定义 base_url / 非 OpenAI 服务)

用于 PlanExecutor(plan 模式)和 MultiAgentOrchestrator(multi 模式)的任务拆解阶段。
"""
# pydantic.BaseModel — 数据模型基类,用于定义结构化输出 schema
# pydantic.Field — 字段定义,可附加 description
from pydantic import BaseModel, Field
# LangChain 消息类型:
#   SystemMessage — 系统指令
#   HumanMessage — 用户消息
from langchain_core.messages import SystemMessage, HumanMessage
# create_model — 模型工厂函数
from models.provider import create_model
# get_logger — structlog 结构化日志(替代裸 print)
from logger import get_logger

# ── 模块级 logger ──────────────────────────────────────────────────────────
# 全局 logger 实例,绑定模块名 __name__,供本文件所有日志调用使用
logger = get_logger(__name__)

# ── 提示词模板 ────────────────────────────────────────────────────────────
# 基础提示词(用于 function_calling 模式)
PLANNER_PROMPT = """Break down the given task into clear, actionable steps.
Each step must be a single atomic action. Do NOT combine unrelated actions into one step.
Generate at least 2 steps. For complex tasks, generate 3-5 steps."""

# JSON 模式提示词(用于纯 LLM + JSON 解析的兜底模式)
# 在基础提示词后追加 JSON 输出格式要求
PLANNER_PROMPT_JSON = PLANNER_PROMPT + """

Return ONLY a valid JSON object (no markdown fences):
{"steps": [{"step": "short title", "details": "what to do"}, ...]}"""


class PlanStep(BaseModel):
    """单个计划步骤的数据模型。

    langchain 的 with_structured_output 会将此 schema 转为
    function calling 的参数定义,LLM 据此生成结构化输出。
    """
    # step: 步骤简短标题
    step: str = Field(description="Short title for the step")
    # details: 步骤详细说明(默认空字符串)
    details: str = Field(default="", description="Elaboration of what to do")


class PlanResult(BaseModel):
    """计划结果的数据模型,包含步骤列表。"""
    # steps: 有序步骤列表
    steps: list[PlanStep] = Field(description="Ordered list of execution steps")


class TaskDecomposer:
    """通过 LLM 生成步骤化计划,使用结构化输出。

    优先用 function_calling(快且准确),失败时降级为纯 LLM + JSON 解析。
    """

    def __init__(self, model_provider: str = "openai", model_name: str = "gpt-4o",
                 *, api_key: str | None = None, base_url: str | None = None) -> None:
        """初始化。

        Args:
            model_provider: 模型提供商
            model_name: 模型名
            api_key: API Key(优先级高于环境变量)
            base_url: 自定义 base URL
        """
        # 创建基础 LLM(temperature=0.3 偏低,保证分解结果稳定)
        base_llm = create_model(model_provider, model_name, temperature=0.3,
                                api_key=api_key, base_url=base_url)
        # with_structured_output — 将 PlanResult schema 绑定到 LLM
        # method="function_calling" 使用 function calling 机制(而非 JSON 模式)
        self.llm = base_llm.with_structured_output(PlanResult, method="function_calling")
        # 保留原始 LLM(无结构化输出),用于 JSON 兜底模式
        self.llm_raw = base_llm

    async def decompose(self, task: str) -> list[dict]:
        """将任务分解为计划步骤。

        尝试两种方式:
          1. function_calling(快速,OpenAI/Anthropic 原生支持)
          2. 纯 LLM + JSON 解析(兜底,兼容自定义 base_url / 非 OpenAI 服务)

        Args:
            task: 待分解的任务文本

        Returns:
            list[dict]: 步骤列表,每项含 "step" 和 "details" 两个键。
                        全部失败时返回单步兜底(直接执行原任务)。
        """
        # ── 尝试1:function calling ─────────────────────────────────
        try:
            result: PlanResult = await self.llm.ainvoke([  # type: ignore[call-arg]
                SystemMessage(content=PLANNER_PROMPT),
                HumanMessage(content=task),
            ])
            # 将 PlanResult 转为简单 dict 列表
            steps = [{"step": s.step, "details": s.details} for s in result.steps]
            # 至少 2 步才算成功(单步分解无意义)
            if len(steps) >= 2:
                return steps
            logger.warning("function_calling_insufficient_steps", steps_count=len(steps))
        except Exception as exc:
            logger.warning("function_calling_failed", error=str(exc), exc_info=True)

        # ── 尝试2:纯 LLM + JSON 解析(通用兼容) ────────────────────
        try:
            # 延迟导入,避免循环依赖
            from json_utils import extract_json
            resp = await self.llm_raw.ainvoke([
                SystemMessage(content=PLANNER_PROMPT_JSON),
                HumanMessage(content=task),
            ])
            # 从 LLM 输出中提取 JSON(容错:处理 markdown 代码块等)
            data = extract_json(resp.content or "")
            raw_steps = data.get("steps", [])
            if isinstance(raw_steps, list) and len(raw_steps) >= 2:
                return [
                    {"step": str(s.get("step", "Task")), "details": str(s.get("details", ""))}
                    for s in raw_steps
                ]
            logger.warning("json_mode_insufficient_steps", steps_count=len(raw_steps) if isinstance(raw_steps, list) else 0)
        except Exception as exc:
            logger.warning("json_mode_failed", error=str(exc), exc_info=True)

        # ── 兜底:直接执行原任务 ────────────────────────────────────
        logger.warning("all_decomposition_failed_fallback")
        return [{"step": task, "details": "Execute the user request directly"}]
