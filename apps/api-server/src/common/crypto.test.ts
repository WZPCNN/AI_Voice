// crypto 单元测试 — 验证 AES-256-GCM 加解密对称性与脱敏逻辑
import { encrypt, decrypt, maskApiKey } from './crypto';

describe('crypto', () => {
  describe('encrypt / decrypt 对称性', () => {
    it('解密后应还原原文', () => {
      const plain = 'sk-1234567890abcdef';
      const encrypted = encrypt(plain);
      expect(encrypted).not.toBe(plain);
      // 密文格式:iv:tag:ciphertext(均 base64)
      expect(encrypted.split(':')).toHaveLength(3);
      expect(decrypt(encrypted)).toBe(plain);
    });

    it('每次加密结果不同(随机 IV)', () => {
      const plain = 'same-text';
      expect(encrypt(plain)).not.toBe(encrypt(plain));
    });

    it('解密无效格式应抛错', () => {
      expect(() => decrypt('invalid')).toThrow();
      expect(() => decrypt('a:b')).toThrow();
    });
  });

  describe('maskApiKey', () => {
    it('长 key 应脱敏为前4+****+后4', () => {
      expect(maskApiKey('sk-abcdefgh12345678')).toBe('sk-a****5678');
    });

    it('短 key(<=8) 应返回 ****', () => {
      expect(maskApiKey('short')).toBe('****');
    });

    it('空字符串应返回 ****', () => {
      expect(maskApiKey('')).toBe('****');
    });
  });
});
