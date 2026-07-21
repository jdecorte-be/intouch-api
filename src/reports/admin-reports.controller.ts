import { Body, Controller, Get, HttpCode, Param, Patch, UseGuards } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { AdminGuard } from "../session/admin.guard";
import { UpdateReportStatusDto } from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

@Controller("admin/reports")
@UseGuards(AdminGuard)
export class AdminReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list() {
    return this.reports.getAdminEventReportsView();
  }

  @Patch(":id/status")
  @HttpCode(200)
  async updateStatus(@Param("id") id: string, @Body() dto: UpdateReportStatusDto) {
    await this.prisma.eventReport.update({ where: { id }, data: { status: dto.status } });

    return this.reports.getAdminEventReportsView();
  }
}
