"""共享 JSON 提取工具 — 被 orchestrator(编排器)和 prompt_architect(提示词架构师)使用。

LLM 经常会在 JSON 外面包一层 markdown 代码块(```json ... ```),
或者附带额外说明文字。本模块提供容错的 JSON 提取能力,
按优先级依次尝试:markdown 代码块 → 正则匹配 → 整段解析 → 返回空字典。
"""
# 导入标准库 json — 用于 JSON 字符串解析
import json
# 导入标准库 re — 用于正则表达式匹配
import re


def extract_json(text: str) -> dict:
    """从 LLM 输出文本中鲁棒地提取 JSON 对象。

    处理顺序(按优先级):
      1. markdown 代码块(```json ... ``` 或 ``` ... ```)
      2. 正则匹配形如 {"areas": [...]} 的对象
      3. 整段文本直接解析
      4. 全部失败时返回空字典 {}

    Args:
        text: LLM 输出的原始文本,可能包含 markdown 标记、注释等

    Returns:
        dict: 解析出的 JSON 字典,失败时为空字典(不抛异常)
    """
    # ── 步骤1:尝试 markdown 代码块 ──────────────────────────────────────
    # 依次尝试 `json 和 ` 两种代码块标记
    for fence in ("`json", "`"):
        if fence in text:
            # 按 fence 分割,取第二部分(代码块内容)
            parts = text.split(fence, 1)
            if len(parts) > 1:
                # rsplit 从右往左分割,取第一个 ` 之前的内容(去除闭合标记)
                inner = parts[1].rsplit("`", 1)[0].strip()
                try:
                    return json.loads(inner)
                except json.JSONDecodeError:
                    # 解析失败,继续尝试下一个 fence
                    pass

    # ── 步骤2:正则匹配 {"areas": [...]} 模式 ────────────────────────────
    # re.DOTALL 让 . 匹配换行符,处理多行 JSON
    m = re.search(r'\{"areas"\s*:\s*\[.*?\].*?\}', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass

    # ── 步骤3:整段文本直接解析(纯 JSON 场景) ──────────────────────────
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # ── 步骤4:全部失败,返回空字典 ──────────────────────────────────────
    return {}
