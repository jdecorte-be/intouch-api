export type ChatMessageView = {
  id: string;
  author: string;
  authorId: string | null;
  authorImage: string | null;
  fromSelf: boolean;
  text: string;
  image: string | null;
  sentAt: string;
};

export type ChatParticipantView = {
  id: string;
  name: string;
  image: string | null;
};

export type ChatThreadView = {
  id: string;
  kind: "event" | "direct";
  title: string;
  subtitle: string;
  accent: string;
  initials: string;
  unreadCount: number;
  participants: ChatParticipantView[];
  participantCount: number;
  messages: ChatMessageView[];
};

export function formatChatTimestamp(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
