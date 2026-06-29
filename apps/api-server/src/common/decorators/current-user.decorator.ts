import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 从 request.user 提取当前登录用户（由 JwtStrategy.validate 返回） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
