/**
 * 全局异常过滤器
 * 统一捕获所有未处理异常，返回结构化错误响应
 * 生产环境隐藏堆栈，开发环境附带 stack 字段便于调试
 * Prisma 已知错误码自动映射为对应 HTTP 状态码
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** 通过 duck typing 识别 Prisma 已知请求错误（避免依赖具体运行时导入路径） */
function isPrismaError(exception: unknown): exception is { code: string; message: string } {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    typeof (exception as { code: unknown }).code === 'string' &&
    (exception as { code: string }).code.startsWith('P')
  );
}

/** Prisma 错误码 → HTTP 状态码映射 */
const PRISMA_ERROR_MAP: Record<string, HttpStatus> = {
  P2002: HttpStatus.CONFLICT,
  P2025: HttpStatus.NOT_FOUND,
  P2003: HttpStatus.BAD_REQUEST,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const msg = (res as { message?: unknown }).message;
        if (typeof msg === 'string') message = msg;
        code = (res as { code?: string }).code ?? exception.name;
      }
    } else if (isPrismaError(exception)) {
      status = PRISMA_ERROR_MAP[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      code = exception.code;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      `${request.method} ${request.url} → ${status} ${code}: ${message}`,
      isProd ? undefined : exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(isProd ? {} : { stack: exception instanceof Error ? exception.stack : undefined }),
    });
  }
}
