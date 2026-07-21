export type ChatMessageView = {
  id: string;
  author: string;
  authorImage: string | null;
  fromSelf: boolean;
  text: string;
  sentAt: string;
};

export type ChatThreadView = {
  id: string;
  kind: "event" | "direct";
  title: string;
  subtitle: string;
  accent: string;
  initials: string;
  unreadCount: number;
  messages: ChatMessageView[];
};

export function formatChatTimestamp(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
