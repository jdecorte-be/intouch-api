import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request, Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { verifySupertokensSession } from './verify-supertokens-session';

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: User }>();
    const response = context.switchToHttp().getResponse<Response>();

    const userId = await verifySupertokensSession(request, response);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.bannedAt) {
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = user;
    return true;
  }
}
