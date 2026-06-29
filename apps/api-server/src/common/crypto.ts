/**
 * AES-256-GCM 对称加密工具
 * 用于加密存储 API Key 等敏感数据，密文格式为 `iv:tag:ciphertext`（均 base64）
 * 密钥来自环境变量 ENCRYPTION_KEY（32 字节 hex = 64 字符），启动时强制校验
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const hexKey = process.env.ENCRYPTION_KEY ?? '';
if (hexKey.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY 必须为 32 字节 hex 字符串（64 字符），请运行 `openssl rand -hex 32` 生成',
  );
}
const KEY = Buffer.from(hexKey, 'hex');

/** 加密明文字符串，返回 `iv:tag:ciphertext` 格式密文 */
export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString('base64')).join(':');
}

/** 解密 `iv:tag:ciphertext` 格式密文，返回明文 */
export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('无效的加密数据格式');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** 脱敏 API Key 用于前端展示（前 4 + **** + 后 4） */
export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}
