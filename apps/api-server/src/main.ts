import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 统一 API 前缀，所有路由自动添加 /api
  app.setGlobalPrefix('api');

  // 全局校验管道：自动校验 DTO、剔除未声明字段、类型转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 全局异常过滤器：统一错误响应格式，生产环境隐藏堆栈
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS：origin 从 CORS_ORIGIN 环境变量读取（逗号分隔多域名）
  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  new Logger('Bootstrap').log(`API server listening on http://localhost:${port}`);
}

bootstrap();
