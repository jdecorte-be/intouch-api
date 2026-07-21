import { Controller, Get, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";

import { serializeSessionUser } from "../common/format/format.util";
import { PrismaService } from "../prisma/prisma.service";
import { BearerAuthGuard } from "../session/bearer-auth.guard";
import { CurrentUser } from "../session/current-user.decorator";
import { EventsService } from "./events.service";

// Bundles everything the profile screen needs in one round trip: the
// signed-in user's own profile, the events/groups they host, and the
// events/groups they've marked interest in. Split by kind because events
// and groups are distinct first-class objects in the product model.
@Controller("me")
@UseGuards(BearerAuthGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async me(@CurrentUser() user: User) {
    const [hostedRows, interestRows] = await Promise.all([
      this.prisma.event.findMany({
        where: { hostId: user.id, isHidden: false },
        orderBy: { startsAt: "asc" },
        select: { id: true },
      }),
      this.prisma.eventInterest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { eventId: true },
      }),
    ]);

    const hostedIds = new Set(hostedRows.map((row) => row.id));
    const interestedIds = interestRows.map((row) => row.eventId).filter((eventId) => !hostedIds.has(eventId));

    const [hosted, interested] = await Promise.all([
      Promise.all([...hostedIds].map((eventId) => this.events.findEventItem(eventId))),
      Promise.all(interestedIds.map((eventId) => this.events.findEventItem(eventId))),
    ]);

    const hostedEvents = hosted.filter((event) => event !== null && event.kind === "event");
    const hostedGroups = hosted.filter((event) => event !== null && event.kind === "group");
    const interestedEvents = interested.filter((event) => event !== null && event.kind === "event");
    const interestedGroups = interested.filter((event) => event !== null && event.kind === "group");

    return {
      user: serializeSessionUser(user),
      hostedEvents,
      hostedGroups,
      interestedEvents,
      interestedGroups,
    };
  }
}
