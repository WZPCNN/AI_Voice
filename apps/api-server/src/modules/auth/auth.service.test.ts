// AuthService 单元测试 — 验证 register/login 的业务逻辑
// bcrypt.hash/compare 使用真实实现(纯计算无 IO),Prisma 与 JwtService 用 mock
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let jwtService: { sign: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    const dto = { name: 'alice', email: 'alice@example.com', password: 'secret123' };

    it('邮箱已存在应抛 ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: dto.email });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('注册成功应返回 token 和脱敏用户(无 password)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        name: 'alice',
        email: dto.email,
        password: 'hashed',
      });
      const result = await service.register(dto);
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe(dto.email);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'u1', email: dto.email });
    });
  });

  describe('login', () => {
    const dto = { email: 'alice@example.com', password: 'secret123' };

    it('用户不存在应抛 UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('用户无 password 字段应抛 UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: dto.email, password: null });
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('密码错误应抛 UnauthorizedException', async () => {
      // 用 bcrypt.hash 生成一个真实的 hash,但用错误密码比对
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        password: hashed,
      });
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('密码正确应返回 token 和脱敏用户', async () => {
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash(dto.password, 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'alice',
        email: dto.email,
        password: hashed,
      });
      const result = await service.login(dto);
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe(dto.email);
    });
  });
});
