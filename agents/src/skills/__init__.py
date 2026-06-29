"""技能包 — 内置技能注册表与查询。

技能(Skill)封装一组专属提示词 + 工具集,
用于 skills 模式下按用户选择切换 Agent 行为。

使用方式:
    from skills import get_skill_by_id, BUILTIN_SKILLS
    skill = get_skill_by_id("code-review")
    if skill:
        runner = AgentRunner(system_prompt=skill.system_prompt, tool_names=skill.tool_names)

内置技能 ID 与前端 SkillsController 一一对应:
  - code-review: 代码审查
  - summarize: 文档摘要
  - web-search: 网络搜索
"""
from .registry import Skill, BUILTIN_SKILLS, get_skill_by_id

__all__ = [
    "Skill",
    "BUILTIN_SKILLS",
    "get_skill_by_id",
]
