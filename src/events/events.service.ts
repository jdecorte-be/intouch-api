import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { getUserInitials } from "../common/format/format.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  categoryEmojis,
  formatCanadianPrice,
  getEventBannerUrlFromTags,
  getEventImageRevisionFromTags,
  getEventSignUpUrlFromTags,
  getPublicEventTags,
  normalizeHostableCategoryInput,
  staticEvents,
  type EventCategory,
  type EventItem,
} from "./event-catalog.const";

type HostedEvent = Prisma.EventGetPayload<{
  include: { host: { select: { name: true; email: true; image: true } } };
}>;

type InterestedAttendee = Prisma.EventInterestGetPayload<{
  include: { user: { select: { name: true; email: true; image: true } } };
}>;

export type EventDiscoveryFilters = {
  category?: EventCategory;
  dateKey?: string;
  kind?: EventItem["kind"];
  limit?: number;
  query?: string;
};

function normalizeEventCategory(value: string) {
  return normalizeHostableCategoryInput(value) ?? "social";
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatStartsAt(date: Date, isFlexible = false, endDate?: Date | null) {
  const now = new Date();
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const time = isFlexible ? "Flexible time" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (endDate && startOfDay(endDate) > startOfDay(date)) {
    const formatDay = (value: Date) => value.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return isFlexible ? `${formatDay(date)} – ${formatDay(endDate)}` : `${formatDay(date)} – ${formatDay(endDate)}, ${time}`;
  }

  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;

  return `${date.toLocaleDateString("en-US", { weekday: "short" })}, ${time}`;
}

export function clampEventLimit(value: number | undefined, fallback = 50) {
  const parsed = value ?? fallback;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

export function isEventDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toEventItem(event: HostedEvent, interestedAttendees: InterestedAttendee[] = []): EventItem {
    const category = normalizeEventCategory(event.category);
    const hostLabel = event.host.name || event.host.email || "Host";
    const kind = event.kind === "group" ? "group" : "event";
    const hostInitials = getUserInitials(hostLabel);
    const bannerUrl = getEventBannerUrlFromTags(event.tags);
    const imageRevision = getEventImageRevisionFromTags(event.tags);
    const publicTags = getPublicEventTags(event.tags);

    return {
      id: event.id,
      kind,
      title: event.title,
      description: event.description || `Join us at ${event.venue} for a ${category} gathering in ${event.neighborhood}.`,
      venue: event.venue,
      neighborhood: event.neighborhood,
      category,
      icon: categoryEmojis[category],
      startsAt: formatStartsAt(event.startsAt, event.isFlexibleTime, event.endsAt),
      startsAtKey: toLocalDateKey(event.startsAt),
      price: formatCanadianPrice(event.price),
      going: event.going,
      capacity: event.capacity,
      hosts: kind === "group" ? [hostInitials] : [],
      attendees:
        kind === "group"
          ? [
              {
                name: hostLabel.replace(/@.*/, ""),
                role: "Group host",
                image: event.host.image,
                isHost: true,
                userId: event.hostId,
              },
              ...interestedAttendees
                .filter((interest) => interest.userId !== event.hostId)
                .map((interest) => ({
                  name: interest.user.name || interest.user.email?.replace(/@.*/, "") || "Member",
                  role: "Group member",
                  image: interest.user.image,
                  userId: interest.userId,
                })),
            ]
          : interestedAttendees.map((interest) => ({
              name: interest.user.name || interest.user.email?.replace(/@.*/, "") || "Member",
              role: "Interested",
              image: interest.user.image,
              userId: interest.userId,
            })),
      tags: publicTags,
      coordinates: [event.longitude, event.latitude],
      accent: event.accent,
      bannerUrl,
      imageRevision,
      signUpUrl: getEventSignUpUrlFromTags(event.tags),
    };
  }

  async getHostedEvents(): Promise<EventItem[]> {
    try {
      const hostedEvents = await this.prisma.event.findMany({
        where: { isHidden: false },
        orderBy: { startsAt: "asc" },
        include: { host: { select: { name: true, email: true, image: true } } },
      });

      if (hostedEvents.length === 0) {
        return [];
      }

      const interests = await this.prisma.eventInterest.findMany({
        where: { eventId: { in: hostedEvents.map((event) => event.id) } },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true, image: true } } },
      });

      const interestsByEventId = new Map<string, InterestedAttendee[]>();

      for (const interest of interests) {
        const bucket = interestsByEventId.get(interest.eventId);

        if (bucket) {
          bucket.push(interest);
        } else {
          interestsByEventId.set(interest.eventId, [interest]);
        }
      }

      return hostedEvents.map((event) => this.toEventItem(event, interestsByEventId.get(event.id)));
    } catch (error) {
      this.logger.warn(`Unable to load hosted events from the database. ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  private eventMatchesFilters(event: EventItem, filters: EventDiscoveryFilters) {
    if (filters.kind && event.kind !== filters.kind) {
      return false;
    }

    if (filters.category && event.category !== filters.category) {
      return false;
    }

    if (filters.dateKey && event.startsAtKey !== filters.dateKey) {
      return false;
    }

    if (filters.query) {
      const query = filters.query.toLowerCase();
      const haystack = [event.title, event.description, event.venue, event.neighborhood, event.category, event.price, ...event.tags]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  }

  async getDiscoveryEvents(filters: EventDiscoveryFilters = {}): Promise<EventItem[]> {
    const hostedEvents = await this.getHostedEvents();
    const limit = filters.limit ?? 50;
    const events = [...hostedEvents, ...staticEvents];

    return events.filter((event) => this.eventMatchesFilters(event, filters)).slice(0, limit);
  }

  async findEventItem(eventId: string): Promise<EventItem | null> {
    const staticEvent = staticEvents.find((event) => event.id === eventId);

    if (staticEvent) {
      return staticEvent;
    }

    try {
      const hostedEvent = await this.prisma.event.findFirst({
        where: { id: eventId, isHidden: false },
        include: { host: { select: { name: true, email: true, image: true } } },
      });

      if (!hostedEvent) {
        return null;
      }

      const interestedAttendees = await this.prisma.eventInterest.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true, image: true } } },
      });

      return this.toEventItem(hostedEvent, interestedAttendees);
    } catch (error) {
      this.logger.warn(`Unable to load hosted events from the database. ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }
}
