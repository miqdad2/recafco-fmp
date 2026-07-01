export { createPrismaClient } from './prisma-client';
export type { DatabaseClientConfig } from './prisma-client';

export { checkDatabaseHealth } from './database-health';
export type { DatabaseHealthResult, DatabaseHealthOk, DatabaseHealthUnavailable } from './database-health';

export type {
  PrismaClient,
  Department,
  Plant,
  Location,
  Role,
  Permission,
  RolePermission,
  User,
  UserSession,
  SecurityAuditEvent,
  IncidentSequence,
  Incident,
  IncidentAction,
  IncidentComment,
  IncidentActivity,
  TaskSequence,
  FactoryTask,
  FactoryTaskProgress,
  FactoryTaskComment,
  FactoryTaskActivity,
  MaintenanceSequence,
  MaintenanceRequest,
  MaintenanceRequestComment,
  MaintenanceRequestActivity,
  SafetyInspectionSequence,
  SafetyInspection,
  SafetyFinding,
  SafetyInspectionComment,
  SafetyInspectionActivity,
} from './generated/prisma/client';
export {
  Prisma,
  IncidentSeverity,
  IncidentStatus,
  IncidentActionStatus,
  TaskPriority,
  TaskStatus,
  MaintenancePriority,
  MaintenanceStatus,
  InspectionStatus,
  FindingSeverity,
  FindingStatus,
} from './generated/prisma/client';
