"""提示词架构师 — 为子智能体生成专属名称、系统提示词和强制约束提示词。

整体接收所有子任务,确保各角色提示词互斥、不重叠。

核心目标:解决多智能体编排中的"角色越界"问题 ——
若各子智能体的 system_prompt 存在职责重叠,会导致多个 Agent 抢答同一问题,
最终输出重复或冲突。本模块通过逐个生成 + 校验的方式避免此问题。
"""
# from __future__ annotations — 启用 PEP 563 延迟注解求值
# 允许在类型注解中使用尚未定义的类名
from __future__ import annotations
# pydantic — 数据验证库(本模块未使用,保留以备扩展)
# LangChain 消息类型
from langchain_core.messages import SystemMessage, HumanMessage
# create_model — 模型工厂
from models.provider import create_model
# extract_json — 容错 JSON 提取
from json_utils import extract_json
# get_logger — structlog 结构化日志(替代裸 print)
from logger import get_logger

# ── 模块级 logger ──────────────────────────────────────────────────────────
# 全局 logger 实例,绑定模块名 __name__,供本文件所有日志调用使用
logger = get_logger(__name__)




# ── 单任务架构师提示词(实际使用) ───────────────────────────────────────
# 每次只为一个子任务设计提示词,并传入其他子任务名以避免重名
ARCHITECT_SINGLE_PROMPT = """你是提示词架构师。为以下一个特定子任务设计专属提示词方案：

输入信息：
- 当前子任务名称及描述
- 所有其他子任务的名称列表（仅用于避免重名，不要为它们设计）

请为该子任务设计：
1. name：一个独特的、能与其他子任务区分的角色中文名称（2-4字，不能与已有名称重复）
2. subtask：该子任务的完整、自包含描述。必须足够具体，使得即使用 PlanExecutor 进一步拆解，每一步骤仍能明确知道目标（例如翻译任务必须写明目标语言）
3. system_prompt：该子智能体的系统提示词，必须严格聚焦该子任务，不得涉及其他子任务
4. constraint_prompt：该子智能体的强制约束提示词

设计原则：
- name 不能与任何现有名称重复
- subtask 必须自包含，不能依赖「原任务」「其他子任务结果」等外部上下文
- system_prompt 必须明确该子智能体「只负责什么」，禁止出现「原任务」「用户问题」「整体需求」等词汇
- constraint_prompt 必须包含职责边界声明和一条针对该子任务特点的自定义强制约束

返回 JSON，包含 name、subtask、system_prompt、constraint_prompt。"""


class PromptArchitect:
    """为子智能体批量生成名称、系统提示词和约束提示词。

    采用"逐个生成"策略:对每个子任务独立调用 LLM,
    确保名称-提示词-子任务三件套锁定在一起,避免批量生成时的对应错乱。
    """

    # 约束提示词模板 — 前缀部分(声明强制约束开始)
    CONSTRAINT_TEMPLATE_PRE = (
        "CRITICAL ROLE CONSTRAINTS - 你必须在以下边界内工作：\n"
    )
    # 约束提示词模板 — 后缀部分(通用职责边界声明)
    CONSTRAINT_TEMPLATE_POST = (
        "\n\n- 你唯一的职责：上述 system_prompt 中描述的任务\n"
        "- 严禁引用、推测或试图回答原始用户问题\n"
        "- 严禁回答你职责范围之外的任何问题\n"
        "- 仅输出你分配任务的最终交付物，不要附加解释、总结或元评论\n"
        "- 如遇到超出职责范围的内容，仅回复「此内容超出我的职责范围」并立即停止"
    )

    def __init__(self, model_provider: str = "openai", model_name: str = "gpt-4o",
                 *, api_key: str | None = None, base_url: str | None = None) -> None:
        """初始化。

        Args:
            model_provider: 模型提供商
            model_name: 模型名
            api_key: API Key
            base_url: 自定义 base URL
        """
        # 单任务 LLM,temperature=0.2 更稳定
        # 使用纯 LLM 调用(不绑定 function calling)
        # 兼容 DeepSeek / thinking 模型等不支持 function calling 的服务
        self.single_llm = create_model(model_provider, model_name, temperature=0.2,
                                       api_key=api_key, base_url=base_url)

    async def design_roles(self, areas: list[dict]) -> list[dict]:
        """为所有子任务区域逐一生成 name、subtask、system_prompt、constraint_prompt。

        每个子智能体独立调用 design_single_role,确保名称-提示词-子任务三件套锁定在一起。

        Args:
            areas: 子任务列表,每项含 "name" 和 "description"

        Returns:
            list[dict]: 增强后的子任务列表,每项含:
                - name: 角色名(LLM 重新生成,避免重名)
                - description: 子任务描述(LLM 可能改写得更具体)
                - system_prompt: 系统提示词
                - constraint_prompt: 约束提示词
                - color: 颜色(原样保留)
        """
        # 收集所有现有名称,用于去重
        all_names = {a.get("name", "") for a in areas}
        enriched = []
        # 逐个处理每个子任务
        for i, a in enumerate(areas):
            raw_name = a.get("name", f"Agent{i}")
            raw_desc = a.get("description", "")
            # 其他子任务名(用于避免重名)
            other_names = all_names - {raw_name}
            # 调用 LLM 生成单任务提示词方案
            result = await self.design_single_role(raw_name, raw_desc, other_names)
            if result is None:
                # LLM 失败时使用兜底方案:简单拼接 + 通用约束
                enriched.append({
                    "name": raw_name,
                    "description": raw_desc,
                    "system_prompt": f"你是{raw_name}，负责以下任务：{raw_desc}",
                    "constraint_prompt": self._build_constraint(raw_desc),
                    "color": a.get("color", "#6366F1"),
                })
                continue
            # LLM 成功:使用 LLM 生成的内容
            a = areas[i]
            enriched.append({
                "name": result.get("name", raw_name),
                "description": result.get("subtask", raw_desc),
                "system_prompt": result.get("system_prompt", ""),
                "constraint_prompt": result.get("constraint_prompt", ""),
                "color": a.get("color", "#6366F1"),
            })
        return enriched

    async def design_single_role(
        self, name: str, description: str, other_names: set[str],
    ) -> dict | None:
        """为单个子任务生成提示词方案。

        Args:
            name: 原始子任务名
            description: 原始子任务描述
            other_names: 其他子任务名集合(用于避免重名)

        Returns:
            dict | None: 包含 name、subtask、system_prompt、constraint_prompt 的字典;
                         LLM 调用失败时返回 None
        """
        # 拼接其他子任务名(用顿号分隔)
        other_names_str = "、".join(other_names) if other_names else "（无其他子任务）"
        # 构造用户消息
        human_text = (
            f"当前子任务：\n名称：{name}\n描述：{description}\n\n"
            f"已有其他子任务名称（不要重复）：{other_names_str}\n\n"
            "请为该子任务设计提示词方案。只输出纯 JSON，不要 markdown 代码块。"
        )
        try:
            # 调用 LLM
            resp = await self.single_llm.ainvoke([
                SystemMessage(content=ARCHITECT_SINGLE_PROMPT),
                HumanMessage(content=human_text),
            ])
            text = (resp.content or "").strip()
            # 从 LLM 输出提取 JSON
            data = extract_json(text)
            return {
                "name": data.get("name", name),
                "subtask": data.get("subtask", description),
                "system_prompt": data.get("system_prompt", ""),
                # 拼接完整约束:前缀 + LLM 生成的约束 + 后缀
                "constraint_prompt": (
                    self.CONSTRAINT_TEMPLATE_PRE +
                    (str(data.get("constraint_prompt", ""))) +
                    self.CONSTRAINT_TEMPLATE_POST
                ),
            }
        except Exception as exc:
            logger.warning("design_role_failed", name=name, error=str(exc), exc_info=True)
            return None

    def _build_constraint(self, description: str) -> str:
        """生成兜底的约束提示词(LLM 失败时使用)。

        Args:
            description: 子任务描述

        Returns:
            str: 完整的约束提示词(前缀 + 描述 + 后缀)
        """
        return (
            f"{self.CONSTRAINT_TEMPLATE_PRE}"
            f"你只能执行与以下描述相关的任务：{description}"
            f"{self.CONSTRAINT_TEMPLATE_POST}"
        )
