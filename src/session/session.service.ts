import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request, Response } from 'express';
import Session from 'supertokens-node/recipe/session';

import { PrismaService } from '../prisma/prisma.service';

// Used by routes where being signed in is optional (e.g. viewing an event's
// comments/reports as a guest vs. as the person who posted them) — unlike
// BearerAuthGuard/AdminGuard, this never throws when there's no session.
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptionalUser(
    request: Request,
    response: Response,
  ): Promise<User | null> {
    const session = await Session.getSession(request, response, {
      sessionRequired: false,
    });

    if (!session) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.getUserId() },
    });

    if (!user || user.bannedAt) {
      return null;
    }

    return user;
  }
}
