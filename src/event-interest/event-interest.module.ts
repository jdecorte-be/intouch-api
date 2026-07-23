import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventInterestController } from './event-interest.controller';
import { EventInterestService } from './event-interest.service';

@Module({
  imports: [EventsModule, NotificationsModule],
  controllers: [EventInterestController],
  providers: [EventInterestService],
})
export class EventInterestModule {}
