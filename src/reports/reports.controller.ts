import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { User } from "@prisma/client";

import { EventsService } from "../events/events.service";
import { PrismaService } from "../prisma/prisma.service";
import { BearerAuthGuard } from "../session/bearer-auth.guard";
import { getBearerToken } from "../session/bearer-token.util";
import { CurrentUser } from "../session/current-user.decorator";
import { SessionService } from "../session/session.service";
import { isReportReason } from "./report-reasons.const";
import { SubmitReportDto } from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

const maxDetailsLength = 600;

@Controller("events/:id/report")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async get(@Param("id") id: string, @Req() req: Request) {
    const token = getBearerToken(req);
    const viewer = token ? await this.sessions.getUserForToken(token) : null;

    return this.reports.getOwnEventReport(id, viewer?.id);
  }

  @Post()
  @UseGuards(BearerAuthGuard)
  async submit(@Param("id") id: string, @CurrentUser() user: User, @Body() dto: SubmitReportDto) {
    const event = await this.events.findEventItem(id);

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    if (!isReportReason(dto.reason)) {
      throw new BadRequestException("Pick a valid report reason");
    }

    const trimmedDetails = (dto.details ?? "").trim().slice(0, maxDetailsLength);

    // Resubmitting reopens the report so admins see the latest signal.
    await this.prisma.eventReport.upsert({
      where: { eventId_reporterId: { eventId: id, reporterId: user.id } },
      update: { reason: dto.reason, details: trimmedDetails, status: "open" },
      create: { eventId: id, reporterId: user.id, reason: dto.reason, details: trimmedDetails },
    });

    return this.reports.getOwnEventReport(id, user.id);
  }

  @Delete()
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async withdraw(@Param("id") id: string, @CurrentUser() user: User) {
    await this.prisma.eventReport.deleteMany({ where: { eventId: id, reporterId: user.id } });

    return this.reports.getOwnEventReport(id, user.id);
  }
}
