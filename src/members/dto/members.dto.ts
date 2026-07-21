import { IsBoolean, IsIn } from "class-validator";

export class UpdateMemberRoleDto {
  @IsIn(["user", "admin"])
  role!: "user" | "admin";
}

export class UpdateMemberBanDto {
  @IsBoolean()
  isBanned!: boolean;
}
