import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertGroupEventDto {
  @IsIn(["event", "group"])
  kind!: "event" | "group";

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  signUpUrl?: string;

  @IsIn(["flexible", "exact"])
  timeMode!: "flexible" | "exact";

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  startsOn?: string;

  @IsOptional()
  @IsString()
  endsOn?: string;

  @IsIn(["pin", "address"])
  locationMode!: "pin" | "address";

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  addressLatitude?: number;

  @IsOptional()
  @IsNumber()
  addressLongitude?: number;
}

export class AdminEventUpsertDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  venue!: string;

  @IsString()
  neighborhood!: string;

  @IsString()
  category!: string;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsBoolean()
  isFlexibleTime!: boolean;

  @IsString()
  price!: string;

  @IsString()
  capacity!: string;

  @IsString()
  going!: string;

  @IsString()
  tags!: string;

  @IsString()
  bannerUrl!: string;

  @IsString()
  signUpUrl!: string;

  @IsString()
  latitude!: string;

  @IsString()
  longitude!: string;

  @IsString()
  accent!: string;

  @IsBoolean()
  isHidden!: boolean;
}

export class AdminEventVisibilityDto {
  @IsBoolean()
  isHidden!: boolean;
}

export class EventDiscoveryQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsIn(["event", "group"])
  kind?: "event" | "group";

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
