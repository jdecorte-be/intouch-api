import { Injectable } from "@nestjs/common";

import { staticEvents } from "../events/event-catalog.const";
import { PrismaService } from "../prisma/prisma.service";
import {
  isReportReason,
  reportReasonLabel,
  type AdminEventReportsView,
  type OwnEventReport,
  type ReportStatus,
} from "./report-reasons.const";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnEventReport(eventId: string, viewerId?: string): Promise<OwnEventReport> {
    if (!viewerId) {
      return null;
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { eventId_reporterId: { eventId, reporterId: viewerId } },
      select: { reason: true, details: true, status: true },
    });

    if (!report) {
      return null;
    }

    return {
      reason: isReportReason(report.reason) ? report.reason : "other",
      details: report.details,
      status: report.status as ReportStatus,
    };
  }

  async getAdminEventReportsView(): Promise<AdminEventReportsView> {
    const reports = await this.prisma.eventReport.findMany({
      orderBy: { createdAt: "desc" },
      include: { reporter: { select: { name: true, email: true } } },
    });

    const hostedEventIds = reports.map((report) => report.eventId).filter((eventId) => !staticEvents.some((event) => event.id === eventId));
    const hostedEvents = hostedEventIds.length
      ? await this.prisma.event.findMany({ where: { id: { in: hostedEventIds } }, select: { id: true, title: true } })
      : [];

    const eventTitle = (eventId: string) =>
      staticEvents.find((event) => event.id === eventId)?.title ?? hostedEvents.find((event) => event.id === eventId)?.title ?? "Deleted event";

    return {
      reports: reports.map((report) => ({
        id: report.id,
        eventId: report.eventId,
        eventTitle: eventTitle(report.eventId),
        reporterName: report.reporter.name || report.reporter.email || "Member",
        reason: isReportReason(report.reason) ? report.reason : "other",
        reasonLabel: reportReasonLabel(report.reason),
        details: report.details,
        status: report.status as ReportStatus,
        createdAt: report.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      })),
      openCount: reports.filter((report) => report.status === "open").length,
      resolvedCount: reports.filter((report) => report.status === "resolved").length,
      dismissedCount: reports.filter((report) => report.status === "dismissed").length,
    };
  }
}
