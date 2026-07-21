import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";

import { AdminGuard } from "../session/admin.guard";
import { CurrentUser } from "../session/current-user.decorator";
import { AdminEventsService } from "./admin-events.service";
import { AdminEventUpsertDto, AdminEventVisibilityDto } from "./dto/events.dto";

@Controller("admin/events")
@UseGuards(AdminGuard)
export class AdminEventsController {
  constructor(private readonly adminEvents: AdminEventsService) {}

  @Get()
  async list() {
    return this.adminEvents.getAdminEventsView();
  }

  @Post()
  async create(@CurrentUser() admin: User, @Body() dto: AdminEventUpsertDto) {
    return this.adminEvents.createAdminEvent(admin.id, dto);
  }

  @Patch(":id")
  @HttpCode(200)
  async update(@Param("id") id: string, @Body() dto: AdminEventUpsertDto) {
    return this.adminEvents.updateAdminEvent(id, dto);
  }

  @Patch(":id/visibility")
  @HttpCode(200)
  async visibility(@Param("id") id: string, @Body() dto: AdminEventVisibilityDto) {
    return this.adminEvents.updateAdminEventVisibility(id, dto.isHidden);
  }

  @Delete(":id")
  @HttpCode(200)
  async remove(@Param("id") id: string) {
    return this.adminEvents.deleteAdminEvent(id);
  }
}
