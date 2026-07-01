import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9][a-z0-9._-]{2,49}$/, {
    message: 'username must be 3–50 chars: lowercase letters, digits, dots, underscores, hyphens; must start with a letter or digit',
  })
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  employeeNumber?: string;

  @IsOptional()
  @IsUUID(4)
  roleId?: string;

  @IsOptional()
  @IsUUID(4)
  departmentId?: string;

  @IsOptional()
  @IsUUID(4)
  plantId?: string;

  @IsOptional()
  @IsUUID(4)
  locationId?: string;
}
