import { Controller, Get, NotFoundException, Param } from "@nestjs/common";

import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(":id/profile")
  async profile(@Param("id") id: string) {
    const profile = await this.users.getPublicUserProfile(id);

    if (!profile) {
      throw new NotFoundException("Member not found");
    }

    return profile;
  }
}
