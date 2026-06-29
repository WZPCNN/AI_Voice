"""模型注册表测试 — 验证 list_models 和 create_model 的行为。

使用 pytest 框架,通过 monkeypatch 注入测试用环境变量,
避免依赖真实的 API Key。
"""
# 从 src/models/provider 导入被测函数
# list_models — 返回可用模型清单
# create_model — 创建 LangChain 聊天模型实例
from src.models.provider import list_models, create_model


def test_list_models():
    """验证 list_models 返回的模型清单包含预期的 provider 和模型。"""
    models = list_models()
    # 检查三大 provider 都存在
    assert "openai" in models
    assert "anthropic" in models
    assert "ollama" in models
    # 检查具体模型存在
    assert "gpt-4o" in models["openai"]
    assert "claude-sonnet-4-20250514" in models["anthropic"]


def test_get_model_defaults(monkeypatch):
    """验证 create_model 在默认参数下的行为。

    使用 monkeypatch 设置测试用 OPENAI_API_KEY,
    避免依赖真实凭据。
    """
    # 注入测试用 API Key(避免真实环境变量干扰)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    # 创建 OpenAI 模型实例
    model = create_model("openai", "gpt-4o", 0.5, streaming=False)
    # 验证实例不为 None
    assert model is not None
    # 验证模型名正确
    assert model.model_name == "gpt-4o"
    # 验证温度正确
    assert model.temperature == 0.5


def test_get_model_unknown_provider(monkeypatch):
    """验证 create_model 对未知 provider 的降级行为。

    未知 provider 应降级为 OpenAI + gpt-4o,而非抛异常。
    """
    # 注入测试用 API Key
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    # 传入未知 provider "unknown"
    model = create_model("unknown", "some-model", 0.5)
    # 验证实例不为 None(未抛异常)
    assert model is not None
    # 验证降级为 gpt-4o
    assert model.model_name == "gpt-4o"
