import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";

import { BearerAuthGuard } from "../session/bearer-auth.guard";
import { CurrentUser } from "../session/current-user.decorator";
import { ChatsService } from "./chats.service";
import { JoinEventChatDto, SendChatMessageDto, StartDirectChatDto } from "./dto/chats.dto";

@Controller("chats")
@UseGuards(BearerAuthGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { threads: await this.chats.getChatThreads(user.id) };
  }

  @Get(":threadId")
  async get(@Param("threadId") threadId: string, @CurrentUser() user: User) {
    return { thread: await this.chats.getChatThread(user.id, threadId) };
  }

  @Post(":threadId/read")
  @HttpCode(200)
  async markRead(@Param("threadId") threadId: string, @CurrentUser() user: User) {
    // Mirrors the original behavior: non-participant read-mark failures are
    // swallowed rather than surfaced as an error.
    await this.chats.markChatThreadReadForUser(user.id, threadId).catch(() => {});
    return { ok: true };
  }

  @Post(":threadId/messages")
  async sendMessage(@Param("threadId") threadId: string, @CurrentUser() user: User, @Body() dto: SendChatMessageDto) {
    await this.chats.sendChatMessageForUser(user.id, user.name || user.email || "You", threadId, dto.text ?? "", dto.image);

    return { thread: await this.chats.getChatThread(user.id, threadId) };
  }

  @Post("join")
  async join(@CurrentUser() user: User, @Body() dto: JoinEventChatDto) {
    return { thread: await this.chats.joinEventChatForUser(user.id, dto.eventId) };
  }

  @Post("direct")
  async direct(@CurrentUser() user: User, @Body() dto: StartDirectChatDto) {
    return { thread: await this.chats.startDirectChatForUser(user.id, dto.member, dto.memberUserId, dto.eventId) };
  }
}
