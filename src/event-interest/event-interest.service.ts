import { Injectable, NotFoundException } from '@nestjs/common';

import { staticEvents } from '../events/event-catalog.const';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export type EventInterestView = {
  going: number;
  isInterested: boolean;
};

@Injectable()
export class EventInterestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}

  async getEventInterestView(
    eventId: string,
    viewerId?: string,
  ): Promise<EventInterestView> {
    const [event, interest, staticInterestCount] = await Promise.all([
      this.prisma.event.findUnique({
        where: { id: eventId },
        select: { going: true },
      }),
      viewerId
        ? this.prisma.eventInterest.findUnique({
            where: { eventId_userId: { eventId, userId: viewerId } },
          })
        : Promise.resolve(null),
      staticEvents.some((event) => event.id === eventId)
        ? this.prisma.eventInterest.count({ where: { eventId } })
        : Promise.resolve(0),
    ]);
    const staticEvent = event
      ? null
      : staticEvents.find((event) => event.id === eventId);

    return {
      going: event?.going ?? (staticEvent?.going ?? 0) + staticInterestCount,
      isInterested: Boolean(interest),
    };
  }

  async toggleEventInterest(
    eventId: string,
    userId: string,
  ): Promise<EventInterestView> {
    const event = await this.events.findEventItem(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const existing = await this.prisma.eventInterest.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    const hostedEvent = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, hostId: true },
    });

    if (hostedEvent && hostedEvent.hostId === userId) {
      return this.getEventInterestView(eventId, userId);
    }

    if (existing) {
      if (hostedEvent) {
        await this.prisma.$transaction([
          this.prisma.eventInterest.delete({ where: { id: existing.id } }),
          this.prisma.event.updateMany({
            where: { id: eventId, going: { gt: 0 } },
            data: { going: { decrement: 1 } },
          }),
        ]);
      } else {
        await this.prisma.eventInterest.delete({ where: { id: existing.id } });
      }
    } else {
      if (hostedEvent) {
        await this.prisma.$transaction([
          this.prisma.eventInterest.create({ data: { eventId, userId } }),
          this.prisma.event.update({
            where: { id: eventId },
            data: { going: { increment: 1 } },
          }),
        ]);

        await this.notifications.create({
          recipientId: hostedEvent.hostId,
          actorId: userId,
          kind: 'like',
          eventId,
          title: `Liked ${event.title}`,
        });
      } else {
        await this.prisma.eventInterest.create({ data: { eventId, userId } });
      }
    }

    return this.getEventInterestView(eventId, userId);
  }
}
