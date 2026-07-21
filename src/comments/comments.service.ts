import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { getUserInitials } from "../common/format/format.util";
import { PrismaService } from "../prisma/prisma.service";

export type EventCommentView = {
  id: string;
  authorName: string;
  authorInitials: string;
  authorImage: string | null;
  isOwn: boolean;
  text: string;
  createdAt: string;
};

export type EventCommentsView = {
  comments: EventCommentView[];
  commentCount: number;
};

type CommentWithAuthor = Prisma.EventCommentGetPayload<{
  include: { author: { select: { name: true; email: true; image: true } } };
}>;

function formatCommentDate(date: Date) {
  const sameYear = date.getFullYear() === new Date().getFullYear();

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function toCommentView(comment: CommentWithAuthor, viewerId?: string): EventCommentView {
  const authorName = comment.author.name || comment.author.email || "Member";

  return {
    id: comment.id,
    authorName,
    authorInitials: getUserInitials(authorName),
    authorImage: comment.author.image,
    isOwn: comment.authorId === viewerId,
    text: comment.text,
    createdAt: formatCommentDate(comment.createdAt),
  };
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEventCommentsView(eventId: string, viewerId?: string): Promise<EventCommentsView> {
    const comments = await this.prisma.eventComment.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, email: true, image: true } } },
    });

    return {
      comments: comments.map((comment) => toCommentView(comment, viewerId)),
      commentCount: comments.length,
    };
  }
}
