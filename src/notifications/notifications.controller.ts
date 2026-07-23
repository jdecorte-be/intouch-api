import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';

import { BearerAuthGuard } from '../session/bearer-auth.guard';
import { CurrentUser } from '../session/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(BearerAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { notifications: await this.notifications.listForUser(user.id) };
  }

  @Patch(':id/read')
  @HttpCode(200)
  async markRead(@Param('id') id: string, @CurrentUser() user: User) {
    await this.notifications.markRead(user.id, id);

    return { ok: true };
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: User) {
    await this.notifications.markAllRead(user.id);

    return { ok: true };
  }
}
