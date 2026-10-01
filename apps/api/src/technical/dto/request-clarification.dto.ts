import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestClarificationDto {
  @IsString()
  @IsNotEmpty({ message: 'A clarification note is required' })
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  note!: string;
}
