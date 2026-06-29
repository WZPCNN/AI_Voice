import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateModelConfigDto {
  @IsString()
  modelProvider!: string;

  @IsString()
  modelName!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  @IsOptional()
  @IsArray()
  tools?: string[];

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;
}

export class UpdateModelConfigDto {
  @IsOptional()
  @IsString()
  modelProvider?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  @IsOptional()
  @IsArray()
  tools?: string[];

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;
}
