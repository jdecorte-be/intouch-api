import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { User } from "@prisma/client";

import { SessionService } from "./session.service";
import { getBearerToken } from "./bearer-token.util";

@Injectable()
export class BearerAuthGuard implements CanActivate {
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

    request.user = user;
    return true;
  }
}
