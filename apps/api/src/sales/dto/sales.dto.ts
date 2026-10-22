import {
  IsString, IsNotEmpty, MaxLength, IsOptional, IsEmail, IsEnum, IsUUID, IsInt, Min, Max, Matches, IsIn, ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SalesEnquiryStatus, SalesActivityType } from '@recafco/database';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
/** Empty text is treated as "not provided" so optional fields can be left blank (and cleared on edit). */
const blankToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};
const moneyTransform = ({ value }: { value: unknown }): unknown => (typeof value === 'number' ? String(value) : blankToNull({ value }));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = 'must be a date in YYYY-MM-DD format';
// Up to 12 digits and 3 decimals, never negative. Blank means "not known yet" - it is never turned into 0.
const MONEY = /^\d{1,12}(\.\d{1,3})?$/;
const MONEY_MSG = 'must be a positive amount with up to 3 decimals';

export class CreateEnquiryDto {
  @IsString() @IsNotEmpty({ message: 'Company / Client Name is required' }) @MaxLength(200) @Transform(trim)
  companyName!: string;

  @IsString() @IsNotEmpty({ message: 'Scope of Work is required' }) @MaxLength(10000) @Transform(trim)
  scopeOfWork!: string;

  @IsOptional() @IsString() @MaxLength(200) @Transform(blankToNull) contactPerson?: string | null;
  @IsOptional() @IsString() @MaxLength(50) @Transform(blankToNull) contactNumber?: string | null;

  @ValidateIf((o: CreateEnquiryDto) => o.email !== null && o.email !== undefined)
  @IsEmail({}, { message: 'Email is not a valid email address' }) @MaxLength(254) @Transform(blankToNull)
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(300) @Transform(blankToNull) projectName?: string | null;
  @IsOptional() @IsString() @MaxLength(300) @Transform(blankToNull) projectLocation?: string | null;
  @IsOptional() @IsString() @MaxLength(100) @Transform(blankToNull) typeOfWork?: string | null;

  @ValidateIf((o: CreateEnquiryDto) => o.estimatedValue !== null && o.estimatedValue !== undefined)
  @Matches(MONEY, { message: `Estimated Project Value ${MONEY_MSG}` }) @Transform(moneyTransform)
  estimatedValue?: string | null;

  @IsOptional() @IsString() @MaxLength(200) @Transform(blankToNull) estimatedValueSource?: string | null;
  @IsOptional() @IsString() @MaxLength(100) @Transform(blankToNull) source?: string | null;

  @ValidateIf((o: CreateEnquiryDto) => o.nextFollowUpDate !== null && o.nextFollowUpDate !== undefined)
  @Matches(DATE, { message: `Next Follow-up Date ${DATE_MSG}` }) @Transform(blankToNull)
  nextFollowUpDate?: string | null;

  @IsOptional() @IsString() @MaxLength(5000) @Transform(blankToNull) remarks?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) @Transform(blankToNull) additionalNotes?: string | null;

  @ValidateIf((o: CreateEnquiryDto) => o.expectedStartDate !== null && o.expectedStartDate !== undefined)
  @Matches(DATE, { message: `Expected Project Start Date ${DATE_MSG}` }) @Transform(blankToNull)
  expectedStartDate?: string | null;

  @ValidateIf((o: CreateEnquiryDto) => o.expectedAwardDate !== null && o.expectedAwardDate !== undefined)
  @Matches(DATE, { message: `Expected Contract Award Date ${DATE_MSG}` }) @Transform(blankToNull)
  expectedAwardDate?: string | null;
}

/** Edit: every field optional; a blank optional field clears it. Company and scope can change but never become empty. */
export class UpdateEnquiryDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Company / Client Name is required' }) @MaxLength(200) @Transform(trim) companyName?: string;
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Scope of Work is required' }) @MaxLength(10000) @Transform(trim) scopeOfWork?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(blankToNull) contactPerson?: string | null;
  @IsOptional() @IsString() @MaxLength(50) @Transform(blankToNull) contactNumber?: string | null;

  @ValidateIf((o: UpdateEnquiryDto) => o.email !== null && o.email !== undefined)
  @IsEmail({}, { message: 'Email is not a valid email address' }) @MaxLength(254) @Transform(blankToNull)
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(300) @Transform(blankToNull) projectName?: string | null;
  @IsOptional() @IsString() @MaxLength(300) @Transform(blankToNull) projectLocation?: string | null;
  @IsOptional() @IsString() @MaxLength(100) @Transform(blankToNull) typeOfWork?: string | null;

  @ValidateIf((o: UpdateEnquiryDto) => o.estimatedValue !== null && o.estimatedValue !== undefined)
  @Matches(MONEY, { message: `Estimated Project Value ${MONEY_MSG}` }) @Transform(moneyTransform)
  estimatedValue?: string | null;

  @IsOptional() @IsString() @MaxLength(200) @Transform(blankToNull) estimatedValueSource?: string | null;
  @IsOptional() @IsString() @MaxLength(100) @Transform(blankToNull) source?: string | null;

  @ValidateIf((o: UpdateEnquiryDto) => o.nextFollowUpDate !== null && o.nextFollowUpDate !== undefined)
  @Matches(DATE, { message: `Next Follow-up Date ${DATE_MSG}` }) @Transform(blankToNull)
  nextFollowUpDate?: string | null;

  @IsOptional() @IsString() @MaxLength(5000) @Transform(blankToNull) remarks?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) @Transform(blankToNull) additionalNotes?: string | null;

  @ValidateIf((o: UpdateEnquiryDto) => o.expectedStartDate !== null && o.expectedStartDate !== undefined)
  @Matches(DATE, { message: `Expected Project Start Date ${DATE_MSG}` }) @Transform(blankToNull)
  expectedStartDate?: string | null;

  @ValidateIf((o: UpdateEnquiryDto) => o.expectedAwardDate !== null && o.expectedAwardDate !== undefined)
  @Matches(DATE, { message: `Expected Contract Award Date ${DATE_MSG}` }) @Transform(blankToNull)
  expectedAwardDate?: string | null;

  /** Reassigning an enquiry to someone else needs sales.manage (checked in the service). */
  @IsOptional() @IsUUID('4') assignedToUserId?: string;
}

export class ChangeStatusDto {
  @IsEnum(SalesEnquiryStatus) status!: SalesEnquiryStatus;

  /** Required for Not Proceeding (Lost). */
  @IsOptional() @IsString() @MaxLength(1000) @Transform(blankToNull) reason?: string | null;

  /** Confirmed (Won) only: the actual confirmed value, when known. Never overwrites the estimate. */
  @ValidateIf((o: ChangeStatusDto) => o.awardedValue !== null && o.awardedValue !== undefined)
  @Matches(MONEY, { message: `Confirmed value ${MONEY_MSG}` }) @Transform(moneyTransform)
  awardedValue?: string | null;

  /** Confirmed (Won) only: the confirmation date (defaults to today in Kuwait). */
  @ValidateIf((o: ChangeStatusDto) => o.wonDate !== null && o.wonDate !== undefined)
  @Matches(DATE, { message: `Confirmation date ${DATE_MSG}` }) @Transform(blankToNull)
  wonDate?: string | null;
}

export const RECORDABLE_ACTIVITY_TYPES: SalesActivityType[] = [
  SalesActivityType.OFFICE_MEETING,
  SalesActivityType.PHONE_CALL,
  SalesActivityType.EMAIL,
  SalesActivityType.CLIENT_VISIT,
  SalesActivityType.QUOTATION_UPDATE,
  SalesActivityType.NOTE,
];

export class AddActivityDto {
  @IsIn(RECORDABLE_ACTIVITY_TYPES, { message: 'Choose what happened' }) type!: SalesActivityType;
  @Matches(DATE, { message: `Date ${DATE_MSG}` }) activityDate!: string;
  @IsString() @IsNotEmpty({ message: 'Please write a short note' }) @MaxLength(5000) @Transform(trim) notes!: string;
}

export class AddFollowUpDto {
  @Matches(DATE, { message: `Follow-up date ${DATE_MSG}` }) followUpDate!: string;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(blankToNull) notes?: string | null;
}

export class CompleteFollowUpDto {
  @IsOptional() @IsString() @MaxLength(2000) @Transform(blankToNull) completionNotes?: string | null;
}

export class RescheduleFollowUpDto {
  @Matches(DATE, { message: `New follow-up date ${DATE_MSG}` }) followUpDate!: string;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(blankToNull) notes?: string | null;
}

export class EnquiryListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(100) @Transform(trim) search?: string;
  /** "open" (every enquiry not yet Confirmed or Not Proceeding), or one or more statuses separated by commas. */
  @IsOptional() @Matches(/^(open|(NEW_ENQUIRY|CONTACTED|MEETING_DONE|QUOTATION_SENT|FOLLOW_UP|WON|LOST)(,(NEW_ENQUIRY|CONTACTED|MEETING_DONE|QUOTATION_SENT|FOLLOW_UP|WON|LOST))*)$/) status?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }) month?: string;
}

export class FollowUpListQueryDto {
  @IsOptional() @IsIn(['OVERDUE', 'TODAY', 'UPCOMING', 'COMPLETED']) bucket?: 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED';
}

export class MonthQueryDto {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }) month?: string;
}
