import { IsString, IsOptional, MaxLength, IsIn, Matches, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONTRACT_ERECTION_DELIVERY_START_STATUSES,
  CreateContractErectionDeliveryItemDto,
  DeliveryDocumentInputDto,
} from './create-contract-erection-delivery-start.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractErectionDeliveryStartDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deliveryReferenceNo?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'deliveryDate must be in YYYY-MM-DD format' })
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedDeliveryWindowStart must be in YYYY-MM-DD format' })
  plannedDeliveryWindowStart?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedDeliveryWindowEnd must be in YYYY-MM-DD format' })
  plannedDeliveryWindowEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  transportMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dispatchProductionSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dispatchFromYard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryToSiteLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  gateEntryContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryNoteOrLrNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  driverContact?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_DELIVERY_START_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  comments?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContractErectionDeliveryItemDto)
  items?: CreateContractErectionDeliveryItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryDocumentInputDto)
  documents?: DeliveryDocumentInputDto[];
}
