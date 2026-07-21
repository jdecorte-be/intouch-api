import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { User } from "@prisma/client";

import { SessionService } from "./session.service";
import { getBearerToken } from "./bearer-token.util";

// Guards admin-only routes. Always re-checks role/ban state against the
// database (never trusts a cached claim), so a revoked admin is locked out
// on their very next request.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: User }>();
    const token = getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Unauthorized");
    }

    const user = await this.sessions.getUserForToken(token);

    if (!user) {
      throw new UnauthorizedException("Unauthorized");
    }

    if (user.role !== "admin" || user.bannedAt) {
      throw new ForbiddenException("Admin access required");
    }

    request.user = user;
    return true;
  }
}
