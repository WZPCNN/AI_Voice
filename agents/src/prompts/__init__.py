"""提示词模块 — 系统提示词的模块化管理。

子模块:
  - identity: 身份规则
  - capabilities: 能力说明
  - tools: 工具使用指南
  - system: 组合函数 + 默认 SYSTEM_PROMPT

通过 compose_system_prompt() 组合各部分,
或直接导入 SYSTEM_PROMPT 获取默认完整提示词。
"""
from .identity import IDENTITY_RULES
from .capabilities import CAPABILITIES
from .tools import TOOL_GUIDE
from .system import compose_system_prompt, SYSTEM_PROMPT

__all__ = [
    "IDENTITY_RULES",
    "CAPABILITIES",
    "TOOL_GUIDE",
    "compose_system_prompt",
    "SYSTEM_PROMPT",
]
