import { IsArray, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export const GENDER_VALUES = ["woman", "man", "non-binary", "prefer-not-to-say"] as const;

export class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}

export class RequestPasswordResetDto {
  @IsString()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  email!: string;

  @IsString()
  token!: string;

  @MinLength(8)
  password!: string;

  @IsString()
  confirmPassword!: string;
}

export class OnboardingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(110)
  age?: number;

  @IsOptional()
  @IsIn(GENDER_VALUES)
  gender?: (typeof GENDER_VALUES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languagesSpoken?: string[];

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  homeNeighborhood?: string;

  @IsOptional()
  @IsNumber()
  homeLatitude?: number;

  @IsOptional()
  @IsNumber()
  homeLongitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventInterests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventGoals?: string[];
}

export class UpdateAccountDto extends OnboardingDto {}
