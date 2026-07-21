import { Injectable } from "@nestjs/common";

import { categoryEmojis } from "../events/event-catalog.const";
import { formatStartsAt } from "../events/events.service";
import { isHostableCategory } from "../events/event-catalog.const";
import { PrismaService } from "../prisma/prisma.service";

const memberSinceFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        eventInterests: true,
        hostedEvents: {
          where: { isHidden: false, kind: "group" },
          orderBy: { startsAt: "desc" },
          take: 6,
          select: { id: true, title: true, category: true, venue: true, neighborhood: true, startsAt: true, endsAt: true, isFlexibleTime: true },
        },
        _count: { select: { hostedEvents: { where: { isHidden: false, kind: "group" } } } },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name || user.email?.replace(/@.*/, "") || "ReTalk member",
      image: user.image,
      memberSince: memberSinceFormatter.format(user.createdAt),
      hostedGroupsCount: user._count.hostedEvents,
      eventInterests: user.eventInterests,
      hostedGroups: user.hostedEvents.map((group) => {
        const category = isHostableCategory(group.category) ? group.category : "social";

        return {
          id: group.id,
          title: group.title,
          category,
          icon: categoryEmojis[category],
          venue: group.venue,
          neighborhood: group.neighborhood,
          startsAt: formatStartsAt(group.startsAt, group.isFlexibleTime, group.endsAt),
        };
      }),
    };
  }
}
