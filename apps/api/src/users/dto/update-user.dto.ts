import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  employeeNumber?: string;

  // Allow null to explicitly clear the field; undefined means "no change"
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID(4)
  departmentId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID(4)
  plantId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID(4)
  locationId?: string | null;
}
