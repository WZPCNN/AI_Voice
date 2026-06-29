"""技能注册表测试 — 验证 BUILTIN_SKILLS 与 get_skill_by_id 的行为。

确保内置技能的元信息完整(与前端 SkillsController 一一对应),
且 system_prompt 已由 compose_system_prompt 正确组合。
"""
from skills import BUILTIN_SKILLS, get_skill_by_id, Skill


def test_builtin_skills_count():
    """内置技能应有 3 个:code-review / summarize / web-search。"""
    assert len(BUILTIN_SKILLS) == 3


def test_builtin_skills_ids():
    """技能 ID 应与前端硬编码列表一致。"""
    ids = [s.id for s in BUILTIN_SKILLS]
    assert ids == ["code-review", "summarize", "web-search"]


def test_skill_metadata_complete():
    """每个技能的 name/description/color/system_prompt 均非空。"""
    for s in BUILTIN_SKILLS:
        assert s.name, f"{s.id} name 为空"
        assert s.description, f"{s.id} description 为空"
        assert s.color.startswith("#"), f"{s.id} color 不是十六进制颜色"
        assert s.system_prompt, f"{s.id} system_prompt 为空"


def test_skill_colors_unique():
    """每个技能的 color 应不同(前端徽章区分用)。"""
    colors = [s.color for s in BUILTIN_SKILLS]
    assert len(set(colors)) == len(colors)


def test_skill_tool_names_empty():
    """内置技能均为纯文本任务,tool_names 应为空列表(非 None)。"""
    for s in BUILTIN_SKILLS:
        assert s.tool_names == [], f"{s.id} tool_names 应为空列表"


def test_get_skill_by_id_found():
    """按 ID 查询应返回对应 Skill 实例。"""
    skill = get_skill_by_id("code-review")
    assert skill is not None
    assert skill.name == "代码审查"
    assert skill.color == "#F59E0B"


def test_get_skill_by_id_not_found():
    """未知 ID 应返回 None。"""
    assert get_skill_by_id("nonexistent") is None


def test_skill_is_frozen():
    """Skill 应为不可变 dataclass(frozen=True)。"""
    skill = get_skill_by_id("summarize")
    import pytest

    with pytest.raises((AttributeError, Exception)):
        skill.name = "modified"  # type: ignore[misc]
