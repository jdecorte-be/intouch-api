import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BearerAuthGuard } from '../session/bearer-auth.guard';
import { CurrentUser } from '../session/current-user.decorator';
import { SessionService } from '../session/session.service';
import { AddCommentDto } from './dto/comments.dto';
import { CommentsService } from './comments.service';

const maxCommentLength = 600;

@Controller('events/:id/comments')
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async list(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const viewer = await this.sessions.getOptionalUser(req, res);

    return this.comments.getEventCommentsView(id, viewer?.id);
  }

  @Post()
  @UseGuards(BearerAuthGuard)
  async add(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: AddCommentDto,
  ) {
    const event = await this.events.findEventItem(id);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const trimmedText = dto.text.trim().slice(0, maxCommentLength);

    if (!trimmedText) {
      throw new BadRequestException('Comment cannot be empty');
    }

    await this.prisma.eventComment.create({
      data: { eventId: id, authorId: user.id, text: trimmedText },
    });

    const hostedEvent = await this.prisma.event.findUnique({
      where: { id },
      select: { hostId: true },
    });

    if (hostedEvent) {
      await this.notifications.create({
        recipientId: hostedEvent.hostId,
        actorId: user.id,
        kind: 'comment',
        eventId: id,
        title: `Commented on ${event.title}`,
        detail: trimmedText,
      });
    }

    return this.comments.getEventCommentsView(id, user.id);
  }

  @Delete(':commentId')
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async remove(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ) {
    await this.prisma.eventComment.deleteMany({
      where: { id: commentId, eventId: id, authorId: user.id },
    });

    return this.comments.getEventCommentsView(id, user.id);
  }
}
