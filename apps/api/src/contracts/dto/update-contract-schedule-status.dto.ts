import { IsIn, IsNotEmpty } from 'class-validator';

// CM-55 — the 5 manager-facing schedule/progress statuses shown on the
// Contract List. Deliberately never includes any ContractStatus (lifecycle)
// value — this DTO can only ever change Contract.scheduleStatus, never
// Contract.status.
const SCHEDULE_STATUSES = ['IN_PROGRESS', 'ON_TRACK', 'DELAYED', 'COMPLETED', 'AHEAD_OF_SCHEDULE'];

export class UpdateContractScheduleStatusDto {
  @IsNotEmpty()
  @IsIn(SCHEDULE_STATUSES)
  scheduleStatus!: string;
}
