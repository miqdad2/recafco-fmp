import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsUUID(4, { each: true })
  permissionIds!: string[];
}
