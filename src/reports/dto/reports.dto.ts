import { IsIn, IsOptional, IsString } from "class-validator";

export class SubmitReportDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class UpdateReportStatusDto {
  @IsIn(["open", "resolved", "dismissed"])
  status!: "open" | "resolved" | "dismissed";
}
