import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const blankToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

/** The source's own ids look like "shapoorji-2025-92". Restrictive on purpose: the id is placed into a URL path. */
export const SOURCE_PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,199}$/;

export class RegisterSourceProjectDto {
  @IsString() @IsNotEmpty() @Transform(trim)
  @Matches(SOURCE_PROJECT_ID_PATTERN, { message: 'sourceProjectId must be the source project id, e.g. shapoorji-2025-92' })
  sourceProjectId!: string;

  /** Optional: link straight away to this contract. */
  @IsOptional() @IsUUID() contractId?: string;

  @IsOptional() @IsString() @MaxLength(500) @Transform(blankToUndefined) reason?: string;
}

export class LinkSourceProjectDto {
  @IsUUID() contractId!: string;

  /** Required by the service when an existing link is being CHANGED. */
  @IsOptional() @IsString() @MaxLength(500) @Transform(blankToUndefined) reason?: string;
}

export class UnlinkSourceProjectDto {
  @IsString() @IsNotEmpty({ message: 'A reason is required to remove a link' }) @MaxLength(500) @Transform(trim)
  reason!: string;
}

export class SetFactoryMappingDto {
  @IsString() @IsNotEmpty() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_-]{1,20}$/, { message: 'factoryCode must be 1-20 letters, digits, - or _ (e.g. PC)' })
  factoryCode!: string;

  @IsUUID() plantId!: string;
}
