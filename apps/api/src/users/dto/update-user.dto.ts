import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
  IsUUID,
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
