import { IsOptional, IsString } from "class-validator";

export class JoinEventChatDto {
  @IsString()
  eventId!: string;
}

export class StartDirectChatDto {
  @IsString()
  member!: string;

  @IsString()
  memberUserId!: string;

  @IsString()
  eventId!: string;
}

export class SendChatMessageDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  image?: string;
}

export class ToggleReactionDto {
  @IsString()
  emoji!: string;
}
