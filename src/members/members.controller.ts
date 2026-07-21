import { Body, Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";

import { AdminGuard } from "../session/admin.guard";
import { CurrentUser } from "../session/current-user.decorator";
import { UpdateMemberBanDto, UpdateMemberRoleDto } from "./dto/members.dto";
import { MembersService } from "./members.service";

@Controller("admin/members")
@UseGuards(AdminGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  async list() {
    return this.members.getAdminMembersView();
  }

  @Patch(":id/role")
  @HttpCode(200)
  async updateRole(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: UpdateMemberRoleDto) {
    return this.members.updateMemberRole(admin.id, id, dto.role);
  }

  @Patch(":id/ban")
  @HttpCode(200)
  async updateBan(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: UpdateMemberBanDto) {
    return this.members.updateMemberBan(admin.id, id, dto.isBanned);
  }

  @Delete(":id")
  @HttpCode(200)
  async remove(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.members.deleteMember(admin.id, id);
  }
}
