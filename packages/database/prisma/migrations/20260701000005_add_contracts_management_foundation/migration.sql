-- Unit 12 — Contracts Management Foundation
-- Migration: 20260701000005_add_contracts_management_foundation
-- Applied 2026-07-01 via shadow DB workaround (prisma db execute --stdin).

-- ---------------------------------------------------------------------------
-- Enum: contract_status
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_status" AS ENUM ('DRAFT', 'ACTIVE', 'TERMINATED', 'CLOSED');

-- ---------------------------------------------------------------------------
-- contract_sequences — atomic reference number generator
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_sequences" (
  "year"     integer NOT NULL,
  "last_seq" integer NOT NULL DEFAULT 0,
  CONSTRAINT "contract_sequences_pkey" PRIMARY KEY ("year"),
  CONSTRAINT "contract_sequences_last_seq_check" CHECK ("last_seq" BETWEEN 0 AND 999999)
);

-- ---------------------------------------------------------------------------
-- contracts
-- ---------------------------------------------------------------------------
CREATE TABLE "contracts" (
  "id"                    uuid           NOT NULL DEFAULT gen_random_uuid(),
  "reference_number"      varchar(25)    NOT NULL,
  "title"                 varchar(300)   NOT NULL,
  "description"           text,
  "status"                "contract_status" NOT NULL DEFAULT 'DRAFT',
  "version"               integer        NOT NULL DEFAULT 1,
  "counterparty_name"     varchar(300)   NOT NULL,
  "counterparty_contact"  varchar(500),
  "contract_value"        numeric(18, 2),
  "currency"              varchar(3),
  "start_date"            date,
  "end_date"              date,
  "renewal_notice_date"   date,
  "owner_user_id"         uuid           NOT NULL,
  "department_id"         uuid,
  "plant_id"              uuid,
  "location_id"           uuid,
  "notes"                 text,
  "created_by_user_id"    uuid           NOT NULL,
  "activated_at"          timestamptz(3),
  "activated_by_user_id"  uuid,
  "terminated_at"         timestamptz(3),
  "terminated_by_user_id" uuid,
  "termination_reason"    varchar(1000),
  "closed_at"             timestamptz(3),
  "closed_by_user_id"     uuid,
  "created_at"            timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at"            timestamptz(3) NOT NULL,
  CONSTRAINT "contracts_pkey"                    PRIMARY KEY ("id"),
  CONSTRAINT "contracts_reference_number_key"    UNIQUE ("reference_number"),
  CONSTRAINT "contracts_version_check"           CHECK ("version" >= 1),
  CONSTRAINT "contracts_reference_number_format" CHECK ("reference_number" ~ '^CONTRACT-[0-9]{4}-[0-9]{6}$')
);

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_owner_user_id_fkey"          FOREIGN KEY ("owner_user_id")          REFERENCES "users"("id")       ON DELETE RESTRICT,
  ADD CONSTRAINT "contracts_created_by_user_id_fkey"     FOREIGN KEY ("created_by_user_id")     REFERENCES "users"("id")       ON DELETE RESTRICT,
  ADD CONSTRAINT "contracts_activated_by_user_id_fkey"   FOREIGN KEY ("activated_by_user_id")   REFERENCES "users"("id")       ON DELETE SET NULL,
  ADD CONSTRAINT "contracts_terminated_by_user_id_fkey"  FOREIGN KEY ("terminated_by_user_id")  REFERENCES "users"("id")       ON DELETE SET NULL,
  ADD CONSTRAINT "contracts_closed_by_user_id_fkey"      FOREIGN KEY ("closed_by_user_id")      REFERENCES "users"("id")       ON DELETE SET NULL,
  ADD CONSTRAINT "contracts_department_id_fkey"          FOREIGN KEY ("department_id")          REFERENCES "departments"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "contracts_plant_id_fkey"               FOREIGN KEY ("plant_id")               REFERENCES "plants"("id")      ON DELETE SET NULL,
  ADD CONSTRAINT "contracts_location_id_fkey"            FOREIGN KEY ("location_id")            REFERENCES "locations"("id")   ON DELETE SET NULL;

CREATE INDEX "contracts_status_created_at_idx"          ON "contracts"("status", "created_at" DESC);
CREATE INDEX "contracts_owner_user_id_status_idx"       ON "contracts"("owner_user_id", "status");
CREATE INDEX "contracts_created_by_user_id_idx"         ON "contracts"("created_by_user_id");
CREATE INDEX "contracts_department_id_idx"              ON "contracts"("department_id");
CREATE INDEX "contracts_plant_id_idx"                   ON "contracts"("plant_id");
CREATE INDEX "contracts_end_date_status_idx"            ON "contracts"("end_date", "status");
CREATE INDEX "contracts_renewal_notice_date_status_idx" ON "contracts"("renewal_notice_date", "status");

-- ---------------------------------------------------------------------------
-- contract_comments — append-only
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_comments" (
  "id"             uuid          NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"    uuid          NOT NULL,
  "author_user_id" uuid          NOT NULL,
  "body"           varchar(5000) NOT NULL,
  "created_at"     timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "contract_comments_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "contract_comments_contract_id_fkey"    FOREIGN KEY ("contract_id")    REFERENCES "contracts"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id")     ON DELETE RESTRICT
);

CREATE INDEX "contract_comments_contract_id_created_at_idx"
  ON "contract_comments"("contract_id", "created_at" ASC);

-- ---------------------------------------------------------------------------
-- contract_activities — append-only audit trail
-- actorUserId has no FK — mirrors IncidentActivity; deactivating a user
-- does not corrupt the contract timeline.
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_activities" (
  "id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"     uuid          NOT NULL,
  "actor_user_id"   uuid,
  "actor_name"      varchar(200),
  "event"           varchar(100)  NOT NULL,
  "previous_status" "contract_status",
  "new_status"      "contract_status",
  "metadata"        jsonb,
  "created_at"      timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "contract_activities_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "contract_activities_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT
);

CREATE INDEX "contract_activities_contract_id_created_at_idx"
  ON "contract_activities"("contract_id", "created_at" ASC);

-- ---------------------------------------------------------------------------
-- Permissions — 8 codes for the contracts module
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at") VALUES
  (gen_random_uuid(), 'contracts.read',      'View Contracts',         'View contract list and details',          'contracts', now()),
  (gen_random_uuid(), 'contracts.create',    'Create Contracts',       'Create new contracts',                    'contracts', now()),
  (gen_random_uuid(), 'contracts.update',    'Edit Contracts',         'Edit draft contracts',                    'contracts', now()),
  (gen_random_uuid(), 'contracts.activate',  'Activate Contracts',     'Transition contracts from DRAFT to ACTIVE', 'contracts', now()),
  (gen_random_uuid(), 'contracts.terminate', 'Terminate Contracts',    'Terminate active contracts',              'contracts', now()),
  (gen_random_uuid(), 'contracts.close',     'Close Contracts',        'Close active or terminated contracts',    'contracts', now()),
  (gen_random_uuid(), 'contracts.comment',   'Comment on Contracts',   'Add comments to contracts',               'contracts', now()),
  (gen_random_uuid(), 'contracts.manage',    'Manage Contracts',       'Full administrative access to contracts', 'contracts', now());

-- ---------------------------------------------------------------------------
-- Role assignments
-- SUPER_ADMIN + ADMIN → all 8 permissions
-- VIEWER              → contracts.read + contracts.comment
-- ---------------------------------------------------------------------------
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
  AND p.code IN (
    'contracts.read', 'contracts.create', 'contracts.update',
    'contracts.activate', 'contracts.terminate', 'contracts.close',
    'contracts.comment', 'contracts.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'VIEWER'
  AND p.code IN ('contracts.read', 'contracts.comment')
ON CONFLICT DO NOTHING;
