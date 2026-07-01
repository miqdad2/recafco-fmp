import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Comment body cannot be empty' })
  @MaxLength(5000)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  body!: string;
}
