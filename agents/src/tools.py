"""Agent 工具注册表与内置工具定义。

本模块定义 Agent 可调用的工具(以 langchain @tool 装饰器声明),
并提供按名称筛选工具的工具函数 get_tools_by_name。
langgraph 的 create_react_agent 会自动识别这些工具并通过函数调用机制触发。
"""
# typing.Any — 类型注解,表示任意类型
from typing import Any
# pydantic.BaseModel — 数据模型基类,用于定义工具输入参数 schema
# pydantic.Field — 字段定义,可附加 description 供 LLM 理解参数含义
from pydantic import BaseModel, Field
# langchain_core.tools.tool — 装饰器,将函数转换为 LangChain Tool 对象
from langchain_core.tools import tool
# datetime — 标准库,用于获取当前时间
import datetime


class CalculatorInput(BaseModel):
    """计算器工具的输入参数 schema。

    LangChain 会将此 schema 转换为 JSON Schema 传给 LLM,
    LLM 据此决定如何调用工具。
    """
    # expression: 数学表达式字符串,如 "2 + 3 * 4"
    # description 会被 LLM 看到用于理解参数含义
    expression: str = Field(description="Mathematical expression to evaluate")


@tool(args_schema=CalculatorInput)
def calculator(expression: str) -> str:
    """安全地计算数学表达式。

    使用 eval 但禁用了所有内建函数(__builtins__: {}),
    仅暴露 abs/round/min/max/pow/sum 这几个白名单函数,
    防止恶意代码执行(如 __import__('os').system(...))。

    Args:
        expression: 数学表达式字符串,如 "2 + 2"、"abs(-5)"

    Returns:
        str: 计算结果字符串,出错时返回 "Error: ..." 字符串
    """
    try:
        # 白名单函数:仅允许这几个安全的内建函数
        allowed_names = {"abs": abs, "round": round, "min": min, "max": max, "pow": pow, "sum": sum}
        # eval 执行表达式:
        #   第2个参数 {} 是全局命名空间(清空 __builtins__,禁用 import/open/exec 等)
        #   第3个参数 allowed_names 是局部命名空间(仅暴露白名单函数)
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        # 返回字符串形式的结果(LLM 工具必须返回字符串)
        return str(result)
    except Exception as e:
        # 任何异常都返回错误字符串,不抛出异常(避免 Agent 崩溃)
        return f"Error evaluating expression: {e}"


@tool
def get_current_time() -> str:
    """获取当前日期和时间。

    无参数工具,返回 ISO 8601 格式的时间字符串,
    如 "2026-06-29T14:30:00.123456"。
    """
    # datetime.datetime.now() — 当前本地时间
    # .isoformat() — 转为 ISO 8601 字符串
    return datetime.datetime.now().isoformat()


# 内置工具列表 — 所有可用的工具在此注册
# langgraph create_react_agent 会将这些工具绑定到 LLM 的 function calling 接口
BUILTIN_TOOLS = [calculator, get_current_time]


def get_tools_by_name(names: list[str] | None = None) -> list:
    """按名称筛选工具。

    Args:
        names: 工具名称列表,如 ["calculator"]。
            None 或空列表时返回全部内置工具。

    Returns:
        list: 筛选后的 Tool 对象列表
    """
    # names 为 None 或空列表时,返回全部工具
    if not names:
        return BUILTIN_TOOLS
    # 转为集合加速查找
    name_set = set(names)
    # 仅保留名称在 name_set 中的工具
    return [t for t in BUILTIN_TOOLS if t.name in name_set]
