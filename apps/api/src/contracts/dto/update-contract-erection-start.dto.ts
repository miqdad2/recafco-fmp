import { IsString, IsOptional, MaxLength, IsIn, IsISO8601, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONTRACT_ERECTION_START_STATUSES,
  ErectionStartManpowerInputDto,
  ErectionStartEquipmentInputDto,
  ErectionStartChecklistInputDto,
} from './create-contract-erection-start.dto';

export class UpdateContractErectionStartDto {
  @IsOptional()
  @IsISO8601()
  actualStartDateTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLocationYard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  erectionCrewTeam?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  supervisor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weatherCondition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  windSpeed?: string;

  @IsOptional()
  @IsString()
  scopeOfWorkToday?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_START_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  comments?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErectionStartManpowerInputDto)
  manpowerRows?: ErectionStartManpowerInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErectionStartEquipmentInputDto)
  equipmentRows?: ErectionStartEquipmentInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErectionStartChecklistInputDto)
  checklistRows?: ErectionStartChecklistInputDto[];
}
