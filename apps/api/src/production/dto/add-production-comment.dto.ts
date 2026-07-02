import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AddProductionCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}
