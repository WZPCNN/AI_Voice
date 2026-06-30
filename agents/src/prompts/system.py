"""系统提示词组合模块 — 将各子模块组合为完整系统提示词。

提供 compose_system_prompt() 函数支持按需替换各段落,
以及预组合的 SYSTEM_PROMPT 常量用于向后兼容。
"""
from .identity import IDENTITY_RULES
from .capabilities import CAPABILITIES
from .tools import TOOL_GUIDE


def compose_system_prompt(
    *,
    identity: str = IDENTITY_RULES,
    capabilities: str = CAPABILITIES,
    tool_guide: str = TOOL_GUIDE,
    intro: str = "你是 AI Voice 智能助手，一个专业的 AI 全能助手。",
) -> str:
    """组合系统提示词的各部分为完整文本。

    Args:
        identity: 身份规则段落
        capabilities: 能力说明段落
        tool_guide: 工具使用指南段落
        intro: 开头介绍语
    Returns:
        完整的系统提示词字符串
    """
    return f"{intro}\n\n{capabilities}\n\n{identity}\n\n{tool_guide}"


# 默认系统提示词（向后兼容,等价于旧 prompts.py 的 SYSTEM_PROMPT）
SYSTEM_PROMPT = compose_system_prompt()
