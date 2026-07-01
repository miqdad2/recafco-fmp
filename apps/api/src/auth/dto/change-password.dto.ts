import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(10, { message: 'New password must be at least 10 characters' })
  @MaxLength(128, { message: 'New password must not exceed 128 characters' })
  newPassword!: string;
}
