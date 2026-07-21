import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { GeocodeService } from "../geocode/geocode.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  categoryAccents,
  eventSignUpUrlTagPrefix,
  formatCanadianPrice,
  getEventSignUpUrlFromTags,
  normalizeHostableCategoryInput,
} from "./event-catalog.const";
import { formatStartsAt } from "./events.service";
import type { UpsertGroupEventDto } from "./dto/events.dto";

const DEFAULT_CAPACITY = 50;
const MAX_CAPACITY = 5000;
const MAX_TAGS = 12;

export type MyEventSummary = {
  id: string;
  title: string;
  description: string;
  venue: string;
  neighborhood: string;
  category: string;
  startsAt: string;
  startsAtIso: string;
  endsAtIso: string | null;
  isFlexibleTime: boolean;
  price: string;
  rawPrice: string;
  going: number;
  capacity: number;
  tags: string[];
  signUpUrl: string | null;
  longitude: number;
  latitude: number;
};

function resolveSignUpUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function withSignUpUrl(tags: string[], signUpUrl: string | null) {
  const publicTags = tags.filter((tag) => !tag.startsWith(eventSignUpUrlTagPrefix));
  return signUpUrl ? [...publicTags, `${eventSignUpUrlTagPrefix}${signUpUrl}`] : publicTags;
}

function isValidCoordinatePair(coordinates: [number, number]) {
  const [longitude, latitude] = coordinates;
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

function parseCapacity(value: number | undefined) {
  const capacity = value ?? DEFAULT_CAPACITY;

  if (!Number.isFinite(capacity) || capacity < 1) {
    return null;
  }

  return Math.min(capacity, MAX_CAPACITY);
}

function parsePublicTags(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag && !tag.startsWith("__") && tag.length <= 32),
    ),
  ).slice(0, MAX_TAGS);
}

function withNoonTime(dateValue: string | undefined) {
  return dateValue ? `${dateValue}T12:00:00` : "";
}

function resolveTiming(dto: UpsertGroupEventDto) {
  const isFlexibleTime = dto.timeMode === "flexible";
  const startsAtInput = isFlexibleTime ? withNoonTime(dto.startsOn) : (dto.startsAt ?? "");
  const endsAtInput = isFlexibleTime ? withNoonTime(dto.endsOn) : (dto.endsAt ?? "");

  const startsAt = startsAtInput ? new Date(startsAtInput) : null;
  let endsAt = endsAtInput ? new Date(endsAtInput) : null;

  if (!startsAt || !endsAt || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    endsAt = null;
  }

  return { startsAt, endsAt, isFlexibleTime };
}

@Injectable()
export class EventsWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocode: GeocodeService,
  ) {}

  private async resolveCoordinates(dto: UpsertGroupEventDto): Promise<[number, number] | null> {
    if (dto.locationMode === "pin") {
      if (!Number.isFinite(dto.latitude) || !Number.isFinite(dto.longitude)) {
        return null;
      }

      const coordinates: [number, number] = [dto.longitude as number, dto.latitude as number];
      return isValidCoordinatePair(coordinates) ? coordinates : null;
    }

    if (dto.locationMode === "address") {
      if (!dto.address) {
        return null;
      }

      if (Number.isFinite(dto.addressLatitude) && Number.isFinite(dto.addressLongitude)) {
        const coordinates: [number, number] = [dto.addressLongitude as number, dto.addressLatitude as number];
        return isValidCoordinatePair(coordinates) ? coordinates : null;
      }

      const coordinates = await this.geocode.geocodeAddress(dto.address);
      return coordinates && isValidCoordinatePair(coordinates) ? coordinates : null;
    }

    return null;
  }

  async createGroupEvent(hostId: string, dto: UpsertGroupEventDto) {
    const kind = dto.kind === "event" ? "event" : "group";
    const title = dto.title.trim().slice(0, 80);
    const description = (dto.description ?? "").trim().slice(0, 1200);
    const category = normalizeHostableCategoryInput(dto.category);
    const price = dto.price?.trim() || "Free";
    const capacity = parseCapacity(dto.capacity);
    const tags = parsePublicTags(dto.tags);
    const signUpUrl = resolveSignUpUrl(dto.signUpUrl);

    if (dto.signUpUrl && !signUpUrl) {
      throw new BadRequestException("Enter a valid sign-up link.");
    }

    if (kind === "event") {
      // Only admins may create top-level "events"; any user can host a group.
      const isAdmin = await this.prisma.user.findUnique({ where: { id: hostId }, select: { role: true, bannedAt: true } });
      if (isAdmin?.role !== "admin" || isAdmin.bannedAt) {
        throw new ForbiddenException("Admin access required");
      }
    }

    if (!title) {
      throw new BadRequestException(`Give your ${kind} a name.`);
    }

    if (!category) {
      throw new BadRequestException(`Pick a category for your ${kind}.`);
    }

    const { startsAt, endsAt, isFlexibleTime } = resolveTiming(dto);

    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException(`Pick a date for your ${kind}.`);
    }

    if (!capacity) {
      throw new BadRequestException("Capacity needs to be at least 1.");
    }

    const coordinates = await this.resolveCoordinates(dto);

    if (!coordinates) {
      throw new BadRequestException(
        dto.locationMode === "address"
          ? "We couldn't find that address — try adding the street number and city."
          : "Drop a pin on the map to set the location.",
      );
    }

    const located = await this.geocode.reverseGeocodeLocation(coordinates);
    const venue = dto.address || located.venue || "Pinned location";
    const neighborhood = located.neighborhood ?? "Toronto";

    const event = await this.prisma.event.create({
      data: {
        kind,
        title,
        description,
        venue,
        neighborhood,
        category,
        startsAt,
        endsAt,
        isFlexibleTime,
        price,
        capacity,
        going: 1,
        tags: withSignUpUrl(tags, signUpUrl),
        longitude: coordinates[0],
        latitude: coordinates[1],
        accent: categoryAccents[category],
        hostId,
      },
    });

    return event;
  }

  private toMyEventSummary(event: {
    id: string;
    title: string;
    description: string;
    venue: string;
    neighborhood: string;
    category: string;
    startsAt: Date;
    endsAt: Date | null;
    isFlexibleTime: boolean;
    price: string;
    going: number;
    capacity: number;
    tags: string[];
    longitude: number;
    latitude: number;
  }): MyEventSummary {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      venue: event.venue,
      neighborhood: event.neighborhood,
      category: event.category,
      startsAt: formatStartsAt(event.startsAt, event.isFlexibleTime, event.endsAt),
      startsAtIso: event.startsAt.toISOString(),
      endsAtIso: event.endsAt?.toISOString() ?? null,
      isFlexibleTime: event.isFlexibleTime,
      price: formatCanadianPrice(event.price),
      rawPrice: event.price,
      going: event.going,
      capacity: event.capacity,
      tags: event.tags.filter((tag) => !tag.startsWith(eventSignUpUrlTagPrefix)),
      signUpUrl: getEventSignUpUrlFromTags(event.tags),
      longitude: event.longitude,
      latitude: event.latitude,
    };
  }

  async loadMyEvents(userId: string): Promise<MyEventSummary[]> {
    const events = await this.prisma.event.findMany({
      where: { hostId: userId, kind: "group" },
      orderBy: { startsAt: "asc" },
    });

    return events.map((event) => this.toMyEventSummary(event));
  }

  async updateGroupEvent(userId: string, eventId: string, dto: UpsertGroupEventDto) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { kind: true, hostId: true, going: true },
    });

    if (!existingEvent || existingEvent.kind !== "group" || existingEvent.hostId !== userId) {
      throw new NotFoundException("Group not found");
    }

    const title = dto.title.trim().slice(0, 80);
    const description = (dto.description ?? "").trim().slice(0, 1200);
    const category = normalizeHostableCategoryInput(dto.category);
    const price = dto.price?.trim() || "Free";
    const capacity = parseCapacity(dto.capacity);
    const tags = parsePublicTags(dto.tags);
    const signUpUrl = resolveSignUpUrl(dto.signUpUrl);

    if (dto.signUpUrl && !signUpUrl) {
      throw new BadRequestException("Enter a valid sign-up link.");
    }

    if (!title) {
      throw new BadRequestException("Give your group a name.");
    }

    if (!category) {
      throw new BadRequestException("Pick a category for your group.");
    }

    const { startsAt, endsAt, isFlexibleTime } = resolveTiming(dto);

    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException("Pick a date for your group.");
    }

    if (!capacity) {
      throw new BadRequestException("Capacity needs to be at least 1.");
    }

    if (capacity < existingEvent.going) {
      throw new BadRequestException(`Capacity cannot be lower than the ${existingEvent.going} people already joined.`);
    }

    const coordinates = await this.resolveCoordinates(dto);

    if (!coordinates) {
      throw new BadRequestException(
        dto.locationMode === "address"
          ? "We couldn't find that address — try adding the street number and city."
          : "Drop a pin on the map to set the location.",
      );
    }

    const located = await this.geocode.reverseGeocodeLocation(coordinates);
    const venue = dto.address || located.venue || "Pinned location";
    const neighborhood = located.neighborhood ?? "Toronto";

    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        title,
        description,
        venue,
        neighborhood,
        category,
        startsAt,
        endsAt,
        isFlexibleTime,
        price,
        capacity,
        tags: withSignUpUrl(tags, signUpUrl),
        longitude: coordinates[0],
        latitude: coordinates[1],
        accent: categoryAccents[category],
      },
    });
  }

  async deleteGroupEvent(userId: string, eventId: string): Promise<MyEventSummary[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { kind: true, hostId: true },
    });

    if (!event || event.kind !== "group" || event.hostId !== userId) {
      throw new NotFoundException("Group not found");
    }

    // Comments, reports, and the event chat thread reference the event by id
    // only (no FK), so they have to be cleaned up alongside it.
    await this.prisma.$transaction([
      this.prisma.chatThread.deleteMany({ where: { id: `event-chat-${eventId}` } }),
      this.prisma.eventComment.deleteMany({ where: { eventId } }),
      this.prisma.eventInterest.deleteMany({ where: { eventId } }),
      this.prisma.eventReport.deleteMany({ where: { eventId } }),
      this.prisma.event.delete({ where: { id: eventId } }),
    ]);

    return this.loadMyEvents(userId);
  }
}
