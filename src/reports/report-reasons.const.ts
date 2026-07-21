export const reportReasons = [
  { value: "spam", label: "Spam or fake event" },
  { value: "scam", label: "Scam or fraud" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "safety", label: "Safety concern" },
  { value: "misleading", label: "Misleading information" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof reportReasons)[number]["value"];
export type ReportStatus = "open" | "resolved" | "dismissed";

export function isReportReason(value: string): value is ReportReason {
  return reportReasons.some((reason) => reason.value === value);
}

export function reportReasonLabel(reason: string) {
  return reportReasons.find((entry) => entry.value === reason)?.label ?? "Something else";
}

export type OwnEventReport = {
  reason: ReportReason;
  details: string;
  status: ReportStatus;
} | null;

export type AdminEventReport = {
  id: string;
  eventId: string;
  eventTitle: string;
  reporterName: string;
  reason: ReportReason;
  reasonLabel: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
};

export type AdminEventReportsView = {
  reports: AdminEventReport[];
  openCount: number;
  resolvedCount: number;
  dismissedCount: number;
};
