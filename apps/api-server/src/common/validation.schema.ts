import * as Joi from 'joi';

/** 环境变量校验 schema，启动时强制校验必填项与格式 */
export const configValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().length(64).hex().required(),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  PORT: Joi.number().default(4000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});
