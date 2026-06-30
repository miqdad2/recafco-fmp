import { IsString, IsNotEmpty, IsOptional, Length, Matches, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 32)
  @Matches(/^[A-Z0-9_-]{2,32}$/, {
    message: 'code must be 2–32 characters: uppercase letters, digits, hyphens, or underscores',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  description?: string;

  @IsOptional()
  @IsUUID(4, { message: 'plantId must be a valid UUID v4' })
  plantId?: string;
}
