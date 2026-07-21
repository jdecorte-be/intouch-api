import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

const memberDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export type MemberRole = "user" | "admin";

export function isMemberRole(value: string): value is MemberRole {
  return value === "user" || value === "admin";
}

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminMembersView() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bannedAt: true,
        createdAt: true,
        _count: { select: { hostedEvents: true, eventReports: true } },
      },
    });

    return {
      members: users.map((user) => ({
        id: user.id,
        name: user.name ?? user.email ?? "Unnamed member",
        email: user.email ?? "No email",
        role: user.role,
        isBanned: Boolean(user.bannedAt),
        bannedAt: user.bannedAt ? memberDateFormatter.format(user.bannedAt) : null,
        joinedAt: memberDateFormatter.format(user.createdAt),
        hostedEvents: user._count.hostedEvents,
        reportsSubmitted: user._count.eventReports,
      })),
      totalMembers: users.length,
      adminCount: users.filter((user) => user.role === "admin" && !user.bannedAt).length,
      bannedCount: users.filter((user) => user.bannedAt).length,
    };
  }

  private async assertAnotherActiveAdmin(memberId: string) {
    const activeAdminCount = await this.prisma.user.count({
      where: { role: "admin", bannedAt: null, id: { not: memberId } },
    });

    if (activeAdminCount === 0) {
      throw new BadRequestException("Keep at least one active admin account");
    }
  }

  async updateMemberRole(adminId: string, memberId: string, role: MemberRole) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true, bannedAt: true },
    });

    if (!member) {
      throw new NotFoundException("Member not found");
    }

    if (role === "admin" && member.bannedAt) {
      throw new BadRequestException("Unban this member before making them an admin");
    }

    if (adminId === member.id && role !== "admin") {
      throw new BadRequestException("You cannot remove your own admin access");
    }

    if (member.role === "admin" && role !== "admin") {
      await this.assertAnotherActiveAdmin(member.id);
    }

    await this.prisma.user.update({ where: { id: member.id }, data: { role } });

    return this.getAdminMembersView();
  }

  async updateMemberBan(adminId: string, memberId: string, isBanned: boolean) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true },
    });

    if (!member) {
      throw new NotFoundException("Member not found");
    }

    if (adminId === member.id && isBanned) {
      throw new BadRequestException("You cannot ban your own account");
    }

    if (member.role === "admin" && isBanned) {
      await this.assertAnotherActiveAdmin(member.id);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: member.id }, data: { bannedAt: isBanned ? new Date() : null } }),
      this.prisma.session.deleteMany({ where: { userId: member.id } }),
    ]);

    return this.getAdminMembersView();
  }

  async deleteMember(adminId: string, memberId: string) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true, hostedEvents: { select: { id: true } } },
    });

    if (!member) {
      throw new NotFoundException("Member not found");
    }

    if (adminId === member.id) {
      throw new BadRequestException("You cannot remove your own account");
    }

    if (member.role === "admin") {
      await this.assertAnotherActiveAdmin(member.id);
    }

    const hostedEventIds = member.hostedEvents.map((event) => event.id);
    const hostedEventThreadIds = hostedEventIds.map((eventId) => `event-chat-${eventId}`);

    // Direct-chat thread ids embed both participants' ids in sorted order, so
    // a plain string-prefix match on the deleted user's id only catches
    // threads where they happened to sort first. Look up every direct
    // thread they actually participate in instead.
    const directThreadIds = (
      await this.prisma.chatThreadParticipant.findMany({
        where: { userId: member.id, thread: { kind: "direct" } },
        select: { threadId: true },
      })
    ).map((row) => row.threadId);

    await this.prisma.$transaction([
      this.prisma.chatThread.deleteMany({
        where: { OR: [{ id: { in: hostedEventThreadIds } }, { id: { in: directThreadIds } }] },
      }),
      this.prisma.eventComment.deleteMany({ where: { OR: [{ authorId: member.id }, { eventId: { in: hostedEventIds } }] } }),
      this.prisma.eventReport.deleteMany({ where: { OR: [{ reporterId: member.id }, { eventId: { in: hostedEventIds } }] } }),
      this.prisma.event.deleteMany({ where: { hostId: member.id } }),
      this.prisma.chatThreadParticipant.deleteMany({ where: { userId: member.id } }),
      this.prisma.session.deleteMany({ where: { userId: member.id } }),
      this.prisma.account.deleteMany({ where: { userId: member.id } }),
      this.prisma.user.delete({ where: { id: member.id } }),
    ]);

    return this.getAdminMembersView();
  }
}
