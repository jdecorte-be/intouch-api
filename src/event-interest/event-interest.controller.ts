import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { User } from "@prisma/client";

import { BearerAuthGuard } from "../session/bearer-auth.guard";
import { CurrentUser } from "../session/current-user.decorator";
import { SessionService } from "../session/session.service";
import { getBearerToken } from "../session/bearer-token.util";
import { EventInterestService } from "./event-interest.service";

@Controller("events/:id/interest")
export class EventInterestController {
  constructor(
    private readonly interest: EventInterestService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async get(@Param("id") id: string, @Req() req: Request) {
    const token = getBearerToken(req);
    const viewer = token ? await this.sessions.getUserForToken(token) : null;

    return this.interest.getEventInterestView(id, viewer?.id);
  }

  @Post("toggle")
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async toggle(@Param("id") id: string, @CurrentUser() user: User) {
    return this.interest.toggleEventInterest(id, user.id);
  }
}
