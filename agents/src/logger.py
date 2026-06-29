"""structlog 配置模块 — 统一的日志记录入口。

替代项目中的裸 print 语句,提供结构化日志输出:
  - 开发环境(debug=True):ConsoleRenderer,彩色可读输出
  - 生产环境(debug=False):JSONRenderer,便于日志采集系统解析

使用方式:
    from logger import get_logger, configure_logging
    configure_logging()  # 仅在入口(worker.py main)调用一次
    logger = get_logger(__name__)
    logger.info("event_name", key=value)
"""
# logging — Python 标准库日志模块,structlog 底层依赖
import logging
# sys — 标准库,用于指定日志输出流(stdout)
import sys
# structlog — 结构化日志库,提供链式 API 和丰富的 processor
import structlog


def configure_logging(debug: bool = False) -> None:
    """配置 structlog 全局设置。

    Args:
        debug: True 时使用 ConsoleRenderer(彩色可读),False 时使用 JSONRenderer
    """
    # 配置标准库 logging 作为底层输出通道
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if debug else logging.INFO,
    )
    # 配置 structlog 的 processor 链
    structlog.configure(
        processors=[
            # 合并 contextvars 中的上下文变量(如 session_id)
            structlog.contextvars.merge_contextvars,
            # 添加 log_level 字段(info/warning/error)
            structlog.processors.add_log_level,
            # 添加 ISO 8601 时间戳
            structlog.processors.TimeStamper(fmt="iso"),
            # 添加调用栈信息(仅 warning 及以上)
            structlog.processors.StackInfoRenderer(),
            # 格式化异常信息
            structlog.processors.format_exc_info,
            # 开发用彩色控制台输出,生产用 JSON(便于 ELK/Loki 采集)
            structlog.dev.ConsoleRenderer() if debug else structlog.processors.JSONRenderer(),
        ],
        # 过滤级别:INFO 及以上才输出
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        # 上下文存储用 dict
        context_class=dict,
        # 日志输出工厂:走标准 stdout
        logger_factory=structlog.PrintLoggerFactory(),
        # 首次调用后缓存 logger,提升性能
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """获取带模块名的 bound logger。

    Args:
        name: 模块名,通常传 __name__

    Returns:
        BoundLogger 实例,支持 logger.info/event/keyword 语法
    """
    return structlog.get_logger(name).bind(module=name)
