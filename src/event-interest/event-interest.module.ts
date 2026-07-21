import { Module } from "@nestjs/common";

import { EventsModule } from "../events/events.module";
import { EventInterestController } from "./event-interest.controller";
import { EventInterestService } from "./event-interest.service";

@Module({
  imports: [EventsModule],
  controllers: [EventInterestController],
  providers: [EventInterestService],
})
export class EventInterestModule {}
