import { Global, Module } from '@nestjs/common';

import { MailerModule } from '../common/mailer/mailer.module';
import { MailerService } from '../common/mailer/mailer.service';
import { PasswordModule } from '../common/password/password.module';
import { PasswordService } from '../common/password/password.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { initSupertokens } from './supertokens.config';

// Must be imported before anything that depends on a session being
// verifiable (SessionModule's guards, AuthModule) — Nest resolves this
// module's constructor while building the DI graph in NestFactory.create(),
// which always runs before main.ts calls app.use(...)/app.listen().
@Global()
@Module({
  imports: [PrismaModule, PasswordModule, MailerModule],
})
export class SupertokensModule {
  constructor(
    prisma: PrismaService,
    password: PasswordService,
    mailer: MailerService,
  ) {
    initSupertokens({ prisma, password, mailer });
  }
}
