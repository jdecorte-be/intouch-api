import { IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

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
  @IsString()
  homeNeighborhood?: string;

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
