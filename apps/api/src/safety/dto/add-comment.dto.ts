import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AddInspectionCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}
