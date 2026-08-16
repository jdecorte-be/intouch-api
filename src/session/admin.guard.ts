import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { verifySupertokensSession } from './verify-supertokens-session';

// Guards admin-only routes. Always re-checks role/ban state against the
// database (never trusts a cached claim), so a revoked admin is locked out
// on their very next request.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: User }>();
    const response = context.switchToHttp().getResponse<Response>();

    const userId = await verifySupertokensSession(request, response);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (user.role !== 'admin' || user.bannedAt) {
      throw new ForbiddenException('Admin access required');
    }

    request.user = user;
    return true;
  }
}
