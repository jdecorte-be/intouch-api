import { Module } from "@nestjs/common";

import { EventsModule } from "../events/events.module";
import { AdminReportsController } from "./admin-reports.controller";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [EventsModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
