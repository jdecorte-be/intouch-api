import { Module } from "@nestjs/common";

import { GeocodeModule } from "../geocode/geocode.module";
import { AdminEventsController } from "./admin-events.controller";
import { AdminEventsService } from "./admin-events.service";
import { EventsController } from "./events.controller";
import { EventsWriteService } from "./events-write.service";
import { EventsService } from "./events.service";
import { MeController } from "./me.controller";

@Module({
  imports: [GeocodeModule],
  controllers: [EventsController, AdminEventsController, MeController],
  providers: [EventsService, EventsWriteService, AdminEventsService],
  exports: [EventsService],
})
export class EventsModule {}
