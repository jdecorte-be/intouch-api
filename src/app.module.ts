import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AdminStatsModule } from "./admin-stats/admin-stats.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { AvatarsModule } from "./avatars/avatars.module";
import { ChatsModule } from "./chats/chats.module";
import { CommentsModule } from "./comments/comments.module";
import { MailerModule } from "./common/mailer/mailer.module";
import { PasswordModule } from "./common/password/password.module";
import { EventInterestModule } from "./event-interest/event-interest.module";
import { EventsModule } from "./events/events.module";
import { GeocodeModule } from "./geocode/geocode.module";
import { HealthModule } from "./health/health.module";
import { MembersModule } from "./members/members.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { SessionModule } from "./session/session.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MailerModule,
    PasswordModule,
    SessionModule,
    AuthModule,
    AvatarsModule,
    GeocodeModule,
    EventsModule,
    EventInterestModule,
    CommentsModule,
    ReportsModule,
    ChatsModule,
    MembersModule,
    AdminStatsModule,
    UsersModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
