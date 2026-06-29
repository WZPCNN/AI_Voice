// Session DTO — 会话创建和更新的请求体验证
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 创建会话 DTO,title 可选,默认 "New Session" */
export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;
}

/** 更新会话 DTO,仅允许修改 title */
export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;
}
