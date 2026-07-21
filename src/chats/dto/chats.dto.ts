import { IsString } from "class-validator";

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
  @IsString()
  text!: string;
}
