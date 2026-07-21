import { Injectable } from "@nestjs/common";

import { staticEvents } from "../events/event-catalog.const";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminAppStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const staticGoing = staticEvents.reduce((sum, event) => sum + event.going, 0);
    const staticCapacity = staticEvents.reduce((sum, event) => sum + event.capacity, 0);

    const [
      totalUsers,
      onboardedUsers,
      newUsersLast7Days,
      activeSessions,
      hostedEvents,
      hostedEventTotals,
      chatThreads,
      chatMessages,
      messagesLast7Days,
      eventComments,
      totalReports,
      openReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { onboardingCompletedAt: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.session.count({ where: { expires: { gt: now } } }),
      this.prisma.event.count(),
      this.prisma.event.aggregate({ _sum: { going: true, capacity: true } }),
      this.prisma.chatThread.count(),
      this.prisma.chatMessage.count(),
      this.prisma.chatMessage.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.eventComment.count(),
      this.prisma.eventReport.count(),
      this.prisma.eventReport.count({ where: { status: "open" } }),
    ]);

    return {
      totalUsers,
      onboardedUsers,
      newUsersLast7Days,
      activeSessions,
      listedEvents: hostedEvents + staticEvents.length,
      hostedEvents,
      staticEvents: staticEvents.length,
      totalGoing: (hostedEventTotals._sum.going ?? 0) + staticGoing,
      totalCapacity: (hostedEventTotals._sum.capacity ?? 0) + staticCapacity,
      chatThreads,
      chatMessages,
      messagesLast7Days,
      eventComments,
      totalReports,
      openReports,
    };
  }
}
