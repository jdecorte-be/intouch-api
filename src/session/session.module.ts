import { Global, Module } from "@nestjs/common";

import { AdminGuard } from "./admin.guard";
import { BearerAuthGuard } from "./bearer-auth.guard";
import { SessionService } from "./session.service";

@Global()
@Module({
  providers: [SessionService, BearerAuthGuard, AdminGuard],
  exports: [SessionService, BearerAuthGuard, AdminGuard],
})
export class SessionModule {}
