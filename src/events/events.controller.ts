import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";

import { BearerAuthGuard } from "../session/bearer-auth.guard";
import { CurrentUser } from "../session/current-user.decorator";
import { isPublicEventCategory } from "./event-catalog.const";
import { EventDiscoveryQueryDto, UpsertGroupEventDto } from "./dto/events.dto";
import { clampEventLimit, EventsService, isEventDateKey } from "./events.service";
import { EventsWriteService } from "./events-write.service";

@Controller("events")
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly eventsWrite: EventsWriteService,
  ) {}

  @Get()
  async list(@Query() query: EventDiscoveryQueryDto) {
    return this.events.getDiscoveryEvents({
      category: query.category && isPublicEventCategory(query.category) ? query.category : undefined,
      dateKey: isEventDateKey(query.date) ? query.date : undefined,
      kind: query.kind,
      query: query.q?.trim().slice(0, 80),
      limit: clampEventLimit(query.limit),
    });
  }

  @Get("mine")
  @UseGuards(BearerAuthGuard)
  async mine(@CurrentUser() user: User) {
    return this.eventsWrite.loadMyEvents(user.id);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const event = await this.events.findEventItem(id);

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    return event;
  }

  @Post()
  @UseGuards(BearerAuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: UpsertGroupEventDto) {
    return this.eventsWrite.createGroupEvent(user.id, dto);
  }

  @Patch(":id")
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async update(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: UpsertGroupEventDto) {
    await this.eventsWrite.updateGroupEvent(user.id, id, dto);
    return { status: "success" };
  }

  @Delete(":id")
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: User, @Param("id") id: string) {
    return this.eventsWrite.deleteGroupEvent(user.id, id);
  }
}
