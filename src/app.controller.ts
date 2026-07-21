import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  root() {
    return { service: "retalk-api", status: "ok" };
  }
}
