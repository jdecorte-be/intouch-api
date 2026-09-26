import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { AdminGuard } from './admin.guard';
import { BearerAuthGuard } from './bearer-auth.guard';
import { verifySupertokensSession } from './verify-supertokens-session';

jest.mock('./verify-supertokens-session', () => ({
  verifySupertokensSession: jest.fn(),
}));

describe('session guards', () => {
  const verify = jest.mocked(verifySupertokensSession);
  const findUnique = jest.fn();
  const prisma = { user: { findUnique } } as never;

  const contextFor = (request: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    verify.mockReset().mockResolvedValue('u1');
    findUnique.mockReset();
  });

  describe('BearerAuthGuard', () => {
    const guard = new BearerAuthGuard(prisma);

    it('attaches the user and allows the request', async () => {
      const user = { id: 'u1', role: 'member', bannedAt: null };
      findUnique.mockResolvedValue(user);
      const request: Record<string, unknown> = {};

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(request.user).toBe(user);
    });

    it('rejects an unknown user', async () => {
      findUnique.mockResolvedValue(null);
      await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a banned user', async () => {
      findUnique.mockResolvedValue({ id: 'u1', bannedAt: new Date() });
      await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('propagates session verification errors', async () => {
      const error = new Error('no session');
      verify.mockRejectedValue(error);
      await expect(guard.canActivate(contextFor({}))).rejects.toBe(error);
      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('AdminGuard', () => {
    const guard = new AdminGuard(prisma);

    it('allows an active admin and attaches the user', async () => {
      const user = { id: 'u1', role: 'admin', bannedAt: null };
      findUnique.mockResolvedValue(user);
      const request: Record<string, unknown> = {};

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.user).toBe(user);
    });

    it('rejects an unknown user as unauthorized', async () => {
      findUnique.mockResolvedValue(null);
      await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('forbids non-admin users', async () => {
      findUnique.mockResolvedValue({
        id: 'u1',
        role: 'member',
        bannedAt: null,
      });
      await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('forbids banned admins', async () => {
      findUnique.mockResolvedValue({
        id: 'u1',
        role: 'admin',
        bannedAt: new Date(),
      });
      await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
