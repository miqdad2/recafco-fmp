import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(3, { message: 'Password must be at least 3 characters' })
  @MaxLength(128, { message: 'New password must not exceed 128 characters' })
  newPassword!: string;
}
