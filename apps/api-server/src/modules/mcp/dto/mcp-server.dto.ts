// MCP 服务器 DTO — 创建和更新 MCP 服务器配置的请求体校验
import { IsBoolean, IsObject, IsOptional, IsString, Matches } from 'class-validator';

/** 创建 MCP 服务器 DTO */
export class CreateMcpServerDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^(stdio|sse)$/)
  transport!: string;

  @IsOptional()
  @IsString()
  command?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** 更新 MCP 服务器 DTO */
export class UpdateMcpServerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(stdio|sse)$/)
  transport?: string;

  @IsOptional()
  @IsString()
  command?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
