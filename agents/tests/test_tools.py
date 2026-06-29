"""内置工具测试 — 验证 calculator 和 get_current_time 的行为。

使用 pytest 框架,通过 .invoke() 直接调用工具(不经过 LLM)。
"""
# 从 src/tools 导入被测对象
# calculator — 计算器工具
# get_current_time — 获取当前时间工具
# BUILTIN_TOOLS — 内置工具列表
from src.tools import calculator, get_current_time, BUILTIN_TOOLS


def test_calculator_basic():
    """验证 calculator 的基础算术运算。"""
    # 加法
    assert float(calculator.invoke({"expression": "2 + 2"})) == 4.0
    # 乘法
    assert float(calculator.invoke({"expression": "10 * 5"})) == 50.0


def test_calculator_complex():
    """验证 calculator 的幂运算。"""
    # 2 的 10 次方 = 1024
    result = float(calculator.invoke({"expression": "2 ** 10"}))
    assert result == 1024.0


def test_calculator_error():
    """验证 calculator 对除零错误的处理。

    应返回错误字符串,而非抛出异常。
    """
    # 1/0 会触发 ZeroDivisionError
    result = calculator.invoke({"expression": "1/0"})
    # 验证返回的是错误信息(包含 "Error" 或 "division")
    assert "Error" in result or "division" in result.lower()


def test_get_current_time():
    """验证 get_current_time 返回有效的 ISO 8601 时间字符串。"""
    result = get_current_time.invoke({})
    # ISO 8601 格式包含 "T"(日期与时间分隔符)
    assert "T" in result
    # 长度应大于 10(至少包含完整日期)
    assert len(result) > 10


def test_all_tools_defined():
    """验证 BUILTIN_TOOLS 列表包含所有预期的工具。"""
    # 应有 2 个工具
    assert len(BUILTIN_TOOLS) == 2
    # 收集所有工具名
    names = {t.name for t in BUILTIN_TOOLS}
    # 验证名称集合
    assert names == {"calculator", "get_current_time"}
