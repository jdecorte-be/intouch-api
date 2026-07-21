import { IsString } from "class-validator";

export class AddCommentDto {
  @IsString()
  text!: string;
}
