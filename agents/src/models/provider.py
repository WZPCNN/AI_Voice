"""模型提供商注册表 — 支持 langchain-openai >=1.3、langchain-anthropic >=1.4 和 Ollama。

所有 provider 都接受可选的 ``timeout`` 参数(秒,默认 120),
避免慢速 API(如 DeepSeek、自建代理)过早触发超时错误。

凭据优先级:
  1. 函数参数传入的 api_key / base_url(来自数据库配置,最高优先级)
  2. 环境变量(OPENAI_API_KEY / ANTHROPIC_API_KEY / OLLAMA_BASE_URL,兜底)
"""
# os — 标准库,读取环境变量作为兜底配置
import os
# 从 logger 模块导入 get_logger — 统一的结构化日志记录器
from logger import get_logger
# BaseChatModel — LangChain 聊天模型的抽象基类,用作类型注解
from langchain_core.language_models import BaseChatModel

# 模块级 logger 实例,绑定模块名用于日志追踪
logger = get_logger(__name__)
# ChatOpenAI — OpenAI 兼容 API 的 LangChain 适配器
# 同时也用于 Ollama(Ollama 提供 OpenAI 兼容接口)
from langchain_openai import ChatOpenAI
# ChatAnthropic — Anthropic Claude 的 LangChain 适配器
from langchain_anthropic import ChatAnthropic

# 可用模型清单 — 用于前端展示和校验
# key: provider 名称;value: 该 provider 支持的模型名列表
AVAILABLE_MODELS: dict[str, list[str]] = {
    "openai": ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o4-mini"],
    "anthropic": ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
    "ollama": ["llama3", "mistral", "gemma2"],
}


def _create_openai(model_name: str, temperature: float, streaming: bool, *,
                   api_key: str | None = None, base_url: str | None = None,
                   timeout: float = 120) -> BaseChatModel:
    """创建 OpenAI ChatOpenAI 实例。

    Args:
        model_name: 模型名,如 "gpt-4o"
        temperature: 采样温度(0~2),越高越随机
        streaming: 是否启用流式输出(本平台主要用流式)
        api_key: OpenAI API Key(None 时从环境变量读取)
        base_url: 自定义 API 地址(用于代理或 OpenAI 兼容服务)
        timeout: 请求超时秒数

    Returns:
        BaseChatModel: ChatOpenAI 实例
    """
    # 构造参数字典
    kwargs: dict = {
        "model": model_name,
        "temperature": temperature,
        "streaming": streaming,
        "timeout": timeout,
        "max_retries": 2,  # 失败自动重试 2 次
    }
    # 仅在显式传入 api_key 时才写入 kwargs(否则 ChatOpenAI 会自动读环境变量)
    if api_key:
        kwargs["api_key"] = api_key
    # 仅在显式传入 base_url 时才写入(用于 OpenAI 兼容代理,如 DeepSeek、Moonshot)
    if base_url:
        kwargs["base_url"] = base_url
    # 记录模型配置(不含 api_key,避免凭据泄露到日志)
    logger.info("model_config_created", provider="openai", model=model_name, temperature=temperature)
    return ChatOpenAI(**kwargs)


def _create_anthropic(model_name: str, temperature: float, streaming: bool, *,
                      api_key: str | None = None, base_url: str | None = None,
                      timeout: float = 120) -> BaseChatModel:
    """创建 Anthropic Claude ChatAnthropic 实例。

    参数含义同 _create_openai,但使用 ChatAnthropic 类。
    Claude 的 temperature 范围是 0~1(比 OpenAI 的 0~2 小)。
    """
    kwargs: dict = {
        "model": model_name,
        "temperature": temperature,
        "streaming": streaming,
        "timeout": timeout,
        "max_retries": 2,
    }
    if api_key:
        kwargs["api_key"] = api_key
    if base_url:
        kwargs["base_url"] = base_url
    return ChatAnthropic(**kwargs)


def _create_ollama(model_name: str, temperature: float, streaming: bool, *,
                   api_key: str | None = None, base_url: str | None = None,
                   timeout: float = 120) -> BaseChatModel:
    """创建 Ollama 模型实例。

    Ollama 提供 OpenAI 兼容的 HTTP API(/v1),
    因此复用 ChatOpenAI 类,只是 base_url 指向本地 Ollama 服务。
    """
    # base_url 优先级:参数 > 环境变量 OLLAMA_BASE_URL > 默认本地地址
    ollama_base = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    # Ollama 默认不需要 API Key,但 ChatOpenAI 要求非空,故用 "ollama" 占位
    return ChatOpenAI(model=model_name, temperature=temperature, streaming=streaming,
                       base_url=ollama_base, api_key=api_key or "ollama",
                       timeout=timeout, max_retries=2)


# Provider 注册表 — key 是 provider 名称,value 是工厂函数
# create_model() 根据 provider 名查找对应的工厂函数
_PROVIDERS: dict[str, callable] = {
    "openai": _create_openai,
    "anthropic": _create_anthropic,
    "ollama": _create_ollama,
}


def create_model(provider: str, model_name: str, temperature: float = 0.7,
                 streaming: bool = True, *,
                 api_key: str | None = None, base_url: str | None = None) -> BaseChatModel:
    """根据 provider 名称创建对应的 LangChain 聊天模型。

    Args:
        provider: "openai" | "anthropic" | "ollama"
        model_name: 模型名,如 "gpt-4o"
        temperature: 采样温度,默认 0.7
        streaming: 是否流式,默认 True
        api_key: API Key(优先级高于环境变量)
        base_url: 自定义 API 地址

    Returns:
        BaseChatModel: 对应 provider 的聊天模型实例

    Note:
        若 provider 未知,降级为 OpenAI + gpt-4o(保证不抛异常)。
    """
    # 从注册表查找工厂函数
    factory = _PROVIDERS.get(provider)
    if factory is None:
        # 未知 provider:降级为 OpenAI,模型名强制为 gpt-4o
        factory = _create_openai
        model_name = "gpt-4o"
    # 调用工厂函数创建模型
    return factory(model_name, temperature, streaming, api_key=api_key, base_url=base_url)


def list_models() -> dict[str, list[str]]:
    """返回所有可用模型清单。

    用于前端设置页展示可选模型列表。
    """
    return AVAILABLE_MODELS
