import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { getUserInitials } from "../common/format/format.util";
import { EventsService } from "../events/events.service";
import { PrismaService } from "../prisma/prisma.service";
import { formatChatTimestamp, type ChatThreadView } from "./chat.types";

type ThreadWithMessages = Prisma.ChatThreadGetPayload<{
  include: {
    messages: { include: { author: { select: { image: true } } } };
    participants: { include: { user: { select: { id: true; name: true; email: true; image: true } } } };
  };
}>;

const threadInclude = {
  messages: { orderBy: { createdAt: "asc" as const }, include: { author: { select: { image: true } } } },
  participants: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
};

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  toChatThreadView(thread: ThreadWithMessages, viewerId: string): ChatThreadView {
    const viewerParticipant = thread.participants.find((participant) => participant.userId === viewerId);
    const counterpart = thread.kind === "direct" ? thread.participants.find((participant) => participant.userId !== viewerId)?.user : null;
    const counterpartName = counterpart ? counterpart.name || counterpart.email?.replace(/@.*/, "") || thread.title : null;

    return {
      id: thread.id,
      kind: thread.kind === "direct" ? "direct" : "event",
      title: counterpartName ?? thread.title,
      subtitle: thread.subtitle,
      accent: thread.accent,
      initials: counterpartName ? getUserInitials(counterpartName) : thread.initials,
      unreadCount: thread.messages.filter(
        (message) => message.authorId !== viewerId && (!viewerParticipant?.lastReadAt || message.createdAt > viewerParticipant.lastReadAt),
      ).length,
      participants: thread.participants.map((participant) => ({
        id: participant.user.id,
        name: participant.user.name || participant.user.email?.replace(/@.*/, "") || "Member",
        image: participant.user.image ?? null,
      })),
      participantCount: thread.participants.length,
      messages: thread.messages.map((message) => ({
        id: message.id,
        author: message.authorName,
        authorId: message.authorId,
        authorImage: message.author?.image ?? null,
        fromSelf: message.authorId !== null && message.authorId === viewerId,
        text: message.text,
        image: message.imageUrl ?? null,
        sentAt: formatChatTimestamp(message.createdAt),
      })),
    };
  }

  async getChatThreads(userId: string): Promise<ChatThreadView[]> {
    const threads = await this.prisma.chatThread.findMany({
      where: { participants: { some: { userId } } },
      include: threadInclude,
    });

    const lastActivity = (thread: ThreadWithMessages) => (thread.messages.at(-1)?.createdAt ?? thread.createdAt).getTime();

    return threads.sort((a, b) => lastActivity(b) - lastActivity(a)).map((thread) => this.toChatThreadView(thread, userId));
  }

  async getChatThread(userId: string, threadId: string): Promise<ChatThreadView> {
    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, participants: { some: { userId } } },
      include: threadInclude,
    });

    if (!thread) {
      throw new NotFoundException("Chat not found");
    }

    return this.toChatThreadView(thread, userId);
  }

  async markChatThreadReadForUser(userId: string, threadId: string) {
    await this.prisma.chatThreadParticipant.update({
      where: { threadId_userId: { threadId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async joinEventChatForUser(userId: string, eventId: string): Promise<ChatThreadView> {
    const event = await this.events.findEventItem(eventId);

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    const threadId = `event-chat-${event.id}`;
    const threadInitials = event.kind === "group" ? event.icon : getUserInitials(event.title);
    const thread = await this.prisma.chatThread.upsert({
      where: { id: threadId },
      update: {
        title: event.title,
        subtitle: `${event.going} going · ${event.neighborhood}`,
        accent: event.accent,
        initials: threadInitials,
      },
      create: {
        id: threadId,
        kind: "event",
        eventId: event.id,
        title: event.title,
        subtitle: `${event.going} going · ${event.neighborhood}`,
        accent: event.accent,
        initials: threadInitials,
        messages: {
          create: {
            authorName: event.hosts[0] ?? "Host",
            text: `Welcome to the ${event.title} chat! Ask anything about the plan before ${event.startsAt}.`,
          },
        },
      },
    });

    await this.prisma.chatThreadParticipant.upsert({
      where: { threadId_userId: { threadId, userId } },
      update: {},
      create: { threadId, userId, lastReadAt: new Date() },
    });

    return this.getChatThread(userId, thread.id);
  }

  async startDirectChatForUser(userId: string, member: string, memberUserId: string, eventId: string): Promise<ChatThreadView> {
    const event = await this.events.findEventItem(eventId);

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    if (memberUserId === userId) {
      throw new BadRequestException("You can't message yourself");
    }

    const recipient = await this.prisma.user.findUnique({ where: { id: memberUserId } });

    if (!recipient) {
      throw new BadRequestException("That person can't be messaged right now");
    }

    const threadId = `direct-chat-${event.id}-${[userId, memberUserId].sort().join("-")}`;
    const thread = await this.prisma.chatThread.upsert({
      where: { id: threadId },
      update: {},
      create: {
        id: threadId,
        kind: "direct",
        eventId: event.id,
        title: member,
        subtitle: `Host of ${event.title}`,
        accent: "#292f36",
        initials: getUserInitials(member),
      },
    });

    await this.prisma.chatThreadParticipant.upsert({
      where: { threadId_userId: { threadId, userId } },
      update: {},
      create: { threadId, userId, lastReadAt: new Date() },
    });
    await this.prisma.chatThreadParticipant.upsert({
      where: { threadId_userId: { threadId, userId: memberUserId } },
      update: {},
      create: { threadId, userId: memberUserId },
    });

    return this.getChatThread(userId, thread.id);
  }

  async sendChatMessageForUser(userId: string, userDisplayName: string, threadId: string, text: string, image?: string) {
    const trimmedText = text.trim();

    if (!trimmedText && !image) {
      return;
    }

    const participant = await this.prisma.chatThreadParticipant.findUnique({
      where: { threadId_userId: { threadId, userId } },
    });

    if (!participant) {
      throw new BadRequestException("Not a participant of this chat");
    }

    await this.prisma.chatMessage.create({
      data: { threadId, authorId: userId, authorName: userDisplayName, text: trimmedText, imageUrl: image ?? null },
    });
  }
}
