import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export const CONTRACT_PARTY_TYPES = ['FIRST_PARTY', 'SECOND_PARTY'] as const;
export type ContractPartyTypeValue = (typeof CONTRACT_PARTY_TYPES)[number];

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
// An emptied optional field arrives as '' — treat it as "not provided".
const trimOrUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

export class CreateContractPartyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(trim)
  name!: string;

  @IsIn(CONTRACT_PARTY_TYPES)
  partyType!: ContractPartyTypeValue;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trimOrUndefined)
  contactNo?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  @Transform(trimOrUndefined)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOrUndefined)
  address?: string;
}

export class UpdateContractPartyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(trim)
  name?: string;

  @IsOptional()
  @IsIn(CONTRACT_PARTY_TYPES)
  partyType?: ContractPartyTypeValue;

  // Empty string clears the value on update.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trim)
  contactNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trim)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ContractPartyListQueryDto {
  @IsOptional()
  @IsIn(CONTRACT_PARTY_TYPES)
  partyType?: ContractPartyTypeValue;

  // 'true' = include inactive parties (the management page); default active only.
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: string;
}
