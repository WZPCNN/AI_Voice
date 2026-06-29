"""技能注册表 — 内置技能定义与查询。

每个技能封装一组专属提示词 + 工具集,
前端在 skills 模式下选择技能后,worker 通过 skill_id 查询此注册表,
获取该技能的 system_prompt 和 tool_names,注入 AgentRunner。

内置技能(与前端 SkillsController 硬编码列表一一对应):
  - code-review: 代码审查
  - summarize: 文档摘要
  - web-search: 网络搜索
"""
# dataclasses.dataclass — 数据类装饰器,自动生成 __init__/__repr__ 等
from dataclasses import dataclass
# prompts.compose_system_prompt — 系统提示词组合函数
from prompts import compose_system_prompt


@dataclass(frozen=True)
class Skill:
    """技能数据类 — 描述一个内置技能的全部元信息。

    Attributes:
        id: 技能唯一标识(前端通过此 ID 选择技能)
        name: 显示名称(中文)
        description: 简短描述(前端展示用)
        color: 主题色(十六进制,与前端一致)
        system_prompt: 该技能专用的完整系统提示词
        tool_names: 启用的工具名列表。
            None 表示沿用默认全部工具,
            空列表表示禁用所有工具(纯文本对话),
            非空列表表示仅启用指定工具。
    """

    id: str
    name: str
    description: str
    color: str
    system_prompt: str
    tool_names: list[str] | None = None


# ── 代码审查技能提示词 ──────────────────────────────────────────────────────
_CODE_REVIEW_PROMPT = compose_system_prompt(
    intro="你是代码审查专家,擅长发现代码质量、风格、潜在 bug 和安全问题。",
    capabilities=(
        "## 核心能力\n"
        "- 审查代码质量:命名、结构、复杂度、可读性\n"
        "- 识别潜在 bug:空指针、边界条件、资源泄漏、并发问题\n"
        "- 检查代码风格:是否符合语言社区规范(PEP8/ESLint 等)\n"
        "- 发现安全风险:注入、XSS、硬编码凭据、不安全依赖\n"
        "- 给出可操作的改进建议,附最小修改示例"
    ),
    tool_guide=(
        "## 审查流程\n"
        "1. 通读代码,理解整体意图与上下文\n"
        "2. 按维度逐项检查:正确性 → 安全 → 可读性 → 性能\n"
        "3. 对每个问题标注严重级别:[严重]/[警告]/[建议]\n"
        "4. 末尾给出总结与优先修复顺序"
    ),
)


# ── 文档摘要技能提示词 ──────────────────────────────────────────────────────
_SUMMARIZE_PROMPT = compose_system_prompt(
    intro="你是文档摘要专家,擅长从长文本中提取关键信息并生成结构化摘要。",
    capabilities=(
        "## 核心能力\n"
        "- 提取文档主旨、关键论点、核心数据\n"
        "- 生成结构化摘要:概述 / 要点 / 结论\n"
        "- 保留关键术语与数字,不添加未出现的信息\n"
        "- 支持中英文混合输入,输出语言跟随用户提问语言"
    ),
    tool_guide=(
        "## 摘要流程\n"
        "1. 通读全文,识别文档类型与主题\n"
        "2. 提取每段核心论点,去重去冗余\n"
        "3. 按以下结构输出:\n"
        "   - **概述**:1-2 句话说明文档主题\n"
        "   - **要点**:无序列表,每条一句话\n"
        "   - **结论**:作者最终观点或行动建议"
    ),
)


# ── 网络搜索技能提示词 ──────────────────────────────────────────────────────
_WEB_SEARCH_PROMPT = compose_system_prompt(
    intro="你是信息检索助手,擅长基于已有知识回答事实性问题。",
    capabilities=(
        "## 核心能力\n"
        "- 回答事实性问题:人物、事件、数据、定义\n"
        "- 综合多个信息源给出平衡答案\n"
        "- 明确区分确凿事实与推测,不确定时如实说明\n"
        "- 回答附带信息时效性说明(知识截止日期)"
    ),
    tool_guide=(
        "## 回答流程\n"
        "1. 解析用户问题的核心实体与意图\n"
        "2. 基于训练知识组织答案,优先权威信息\n"
        "3. 若问题涉及实时数据或超出知识范围,明确告知并建议查阅最新来源\n"
        "4. 结构化输出:直接答案 → 补充说明 → 来源类型(官方/媒体/百科)"
    ),
)


# ── 内置技能注册表 ──────────────────────────────────────────────────────────
# 顺序与前端 SkillsController 返回列表一致
BUILTIN_SKILLS: list[Skill] = [
    Skill(
        id="code-review",
        name="代码审查",
        description="审查代码质量、风格、潜在 bug",
        color="#F59E0B",
        system_prompt=_CODE_REVIEW_PROMPT,
        # 代码审查为纯分析任务,不需要计算器或时间工具
        tool_names=[],
    ),
    Skill(
        id="summarize",
        name="文档摘要",
        description="提取文档关键信息,生成结构化摘要",
        color="#10B981",
        system_prompt=_SUMMARIZE_PROMPT,
        tool_names=[],
    ),
    Skill(
        id="web-search",
        name="网络搜索",
        description="搜索网络信息,回答事实性问题",
        color="#3B82F6",
        system_prompt=_WEB_SEARCH_PROMPT,
        tool_names=[],
    ),
]


def get_skill_by_id(skill_id: str) -> Skill | None:
    """按 ID 查询内置技能。

    Args:
        skill_id: 技能 ID,如 "code-review"
    Returns:
        Skill 实例;未找到返回 None
    """
    for s in BUILTIN_SKILLS:
        if s.id == skill_id:
            return s
    return None
