import { Injectable } from '@nestjs/common';

import { formatRelativeTime } from '../common/format/format.util';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationKind = 'comment' | 'generated' | 'invite' | 'like';

export type NotificationView = {
  id: string;
  actor: string;
  actorImage: string | null;
  time: string;
  title: string;
  detail: string | null;
  unread: boolean;
  kind: NotificationKind;
  eventId: string | null;
};

type CreateNotificationInput = {
  recipientId: string;
  actorId?: string | null;
  kind: NotificationKind;
  eventId?: string | null;
  title: string;
  detail?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<NotificationView[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { name: true, email: true, image: true } } },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      actor:
        notification.actor?.name ||
        notification.actor?.email?.replace(/@.*/, '') ||
        'Someone',
      actorImage: notification.actor?.image ?? null,
      time: formatRelativeTime(notification.createdAt),
      title: notification.title,
      detail: notification.detail,
      unread: notification.unread,
      kind: notification.kind as NotificationKind,
      eventId: notification.eventId,
    }));
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { unread: false },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, unread: true },
      data: { unread: false },
    });
  }

  // Skips self-notifications, e.g. a host commenting on or liking their own event.
  async create(input: CreateNotificationInput): Promise<void> {
    if (input.actorId && input.actorId === input.recipientId) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        kind: input.kind,
        eventId: input.eventId ?? null,
        title: input.title,
        detail: input.detail ?? null,
      },
    });
  }
}
