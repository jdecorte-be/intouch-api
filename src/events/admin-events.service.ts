import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { getUserInitials } from "../common/format/format.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  categoryAccents,
  eventBannerTagPrefix,
  eventImageRevisionTagPrefix,
  eventSignUpUrlTagPrefix,
  getEventBannerUrlFromTags,
  getEventSignUpUrlFromTags,
  getPublicEventTags,
  normalizeHostableCategoryInput,
} from "./event-catalog.const";
import { formatStartsAt } from "./events.service";

const adminEventDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function formatDateTimeInput(date: Date | null) {
  if (!date) return "";

  const pad = (value: number) => String(value).padStart(2, "0");

  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type AdminEventUpdateInput = {
  title: string;
  description: string;
  venue: string;
  neighborhood: string;
  category: string;
  startsAt: string;
  endsAt: string;
  isFlexibleTime: boolean;
  price: string;
  capacity: string;
  going: string;
  tags: string;
  bannerUrl: string;
  signUpUrl: string;
  latitude: string;
  longitude: string;
  accent: string;
  isHidden: boolean;
};

function parseDateTimeInput(value: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function normalizeHexColor(value: string, fallback: string) {
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeBannerUrl(value: string) {
  const bannerUrl = value.trim();
  if (!bannerUrl) return "";

  try {
    const url = new URL(bannerUrl);
    if (url.protocol !== "https:") throw new Error();
    return url.toString().slice(0, 1000);
  } catch {
    throw new BadRequestException("Enter a valid HTTPS banner image URL");
  }
}

function normalizeSignUpUrl(value: string) {
  const signUpUrl = value.trim();
  if (!signUpUrl) return "";

  try {
    const url = new URL(signUpUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString().slice(0, 2000);
  } catch {
    throw new BadRequestException("Enter a valid sign-up page URL");
  }
}

function parseEventUpdateInput(input: AdminEventUpdateInput) {
  const title = input.title.trim().slice(0, 80);
  const description = input.description.trim().slice(0, 1200);
  const venue = input.venue.trim().slice(0, 160);
  const neighborhood = input.neighborhood.trim().slice(0, 120);
  const price = input.price.trim().slice(0, 80) || "Free";
  const category = normalizeHostableCategoryInput(input.category);
  const capacity = Number.parseInt(input.capacity, 10);
  const going = Number.parseInt(input.going, 10);
  const latitude = Number.parseFloat(input.latitude);
  const longitude = Number.parseFloat(input.longitude);
  const startsAt = parseDateTimeInput(input.startsAt);
  const endsAt = parseDateTimeInput(input.endsAt);
  const bannerUrl = normalizeBannerUrl(input.bannerUrl);
  const signUpUrl = normalizeSignUpUrl(input.signUpUrl);

  if (!title) throw new BadRequestException("Event title is required");
  if (!venue) throw new BadRequestException("Venue is required");
  if (!neighborhood) throw new BadRequestException("Neighborhood is required");
  if (!category) throw new BadRequestException("Pick a valid event category");
  if (!startsAt) throw new BadRequestException("Start date and time are required");
  if (!Number.isFinite(capacity) || capacity < 1) throw new BadRequestException("Capacity needs to be at least 1");
  if (!Number.isFinite(going) || going < 0) throw new BadRequestException("Going count cannot be negative");
  if (going > capacity) throw new BadRequestException("Going count cannot be higher than capacity");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new BadRequestException("Enter valid latitude and longitude values");
  }

  return {
    title,
    description,
    venue,
    neighborhood,
    category,
    startsAt,
    endsAt: endsAt && endsAt > startsAt ? endsAt : null,
    isFlexibleTime: input.isFlexibleTime,
    price,
    capacity,
    going,
    tags: [
      ...getPublicEventTags(
        input.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ).slice(0, 12),
      ...(bannerUrl ? [`${eventBannerTagPrefix}${bannerUrl}`, `${eventImageRevisionTagPrefix}${Date.now().toString(36)}`] : []),
      ...(signUpUrl ? [`${eventSignUpUrlTagPrefix}${signUpUrl}`] : []),
    ],
    latitude,
    longitude,
    accent: normalizeHexColor(input.accent, categoryAccents[category]),
    isHidden: input.isHidden,
  };
}

@Injectable()
export class AdminEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminEventsView() {
    const events = await this.prisma.event.findMany({
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      include: { host: { select: { name: true, email: true } } },
    });
    const reports = events.length
      ? await this.prisma.eventReport.groupBy({
          by: ["eventId"],
          where: { eventId: { in: events.map((event) => event.id) } },
          _count: { _all: true },
        })
      : [];
    const reportCounts = new Map(reports.map((report) => [report.eventId, report._count._all]));

    return {
      events: events.map((event) => {
        const category = normalizeHostableCategoryInput(event.category) ?? "social";

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          venue: event.venue,
          neighborhood: event.neighborhood,
          category,
          startsAt: formatStartsAt(event.startsAt, event.isFlexibleTime, event.endsAt),
          startsAtInput: formatDateTimeInput(event.startsAt),
          endsAtInput: formatDateTimeInput(event.endsAt),
          isFlexibleTime: event.isFlexibleTime,
          createdAt: adminEventDateFormatter.format(event.createdAt),
          hostName: event.host.name ?? event.host.email ?? "Host",
          hostEmail: event.host.email ?? "No email",
          isHidden: event.isHidden,
          price: event.price,
          going: event.going,
          capacity: event.capacity,
          tags: getPublicEventTags(event.tags),
          bannerUrl: getEventBannerUrlFromTags(event.tags) ?? "",
          signUpUrl: getEventSignUpUrlFromTags(event.tags) ?? "",
          latitude: event.latitude,
          longitude: event.longitude,
          accent: event.accent,
          reports: reportCounts.get(event.id) ?? 0,
        };
      }),
      totalEvents: events.length,
      visibleCount: events.filter((event) => !event.isHidden).length,
      hiddenCount: events.filter((event) => event.isHidden).length,
    };
  }

  async createAdminEvent(adminId: string, input: AdminEventUpdateInput) {
    const create = parseEventUpdateInput(input);

    return this.prisma.event.create({
      data: { ...create, kind: "event", hostId: adminId },
      select: { id: true, title: true },
    });
  }

  async updateAdminEvent(eventId: string, input: AdminEventUpdateInput) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    const update = parseEventUpdateInput(input);

    await this.prisma.$transaction([
      this.prisma.event.update({ where: { id: event.id }, data: update }),
      this.prisma.chatThread.updateMany({
        where: { id: `event-chat-${event.id}` },
        data: {
          title: update.title,
          subtitle: `${update.going} going · ${update.neighborhood}`,
          accent: update.accent,
          initials: getUserInitials(update.title),
        },
      }),
    ]);

    return this.getAdminEventsView();
  }

  async updateAdminEventVisibility(eventId: string, isHidden: boolean) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    await this.prisma.event.update({ where: { id: event.id }, data: { isHidden } });

    return this.getAdminEventsView();
  }

  async deleteAdminEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    // Also cleans up EventInterest rows here (the original admin delete path
    // did not, unlike the member-owned delete flow — fixed for consistency).
    await this.prisma.$transaction([
      this.prisma.chatThread.deleteMany({ where: { id: `event-chat-${event.id}` } }),
      this.prisma.eventComment.deleteMany({ where: { eventId: event.id } }),
      this.prisma.eventInterest.deleteMany({ where: { eventId: event.id } }),
      this.prisma.eventReport.deleteMany({ where: { eventId: event.id } }),
      this.prisma.event.delete({ where: { id: event.id } }),
    ]);

    return this.getAdminEventsView();
  }
}
