-- FMP-SALES-01 — Sales & Enquiries foundation. Additive only: 3 enums, 4 tables, indexes and
-- foreign keys, then the sales.* permissions and two roles. No existing table, column, role,
-- role mapping or user is changed or removed.
--
-- Permissions: sales.read, sales.create, sales.update, sales.manage, sales.reports.read.
-- SALES_MANAGER holds all five; SALES_VIEWER holds read + reports.read. SUPER_ADMIN receives the
-- five codes like every other module (it holds all permissions); ADMIN and every other role get
-- nothing, so Sales access stays a deliberate assignment.

-- CreateEnum
CREATE TYPE "SalesEnquiryStatus" AS ENUM ('NEW_ENQUIRY', 'CONTACTED', 'MEETING_DONE', 'QUOTATION_SENT', 'FOLLOW_UP', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "SalesActivityType" AS ENUM ('OFFICE_MEETING', 'PHONE_CALL', 'EMAIL', 'CLIENT_VISIT', 'FOLLOW_UP', 'QUOTATION_UPDATE', 'STATUS_CHANGE', 'NOTE', 'ENQUIRY_UPDATED');

-- CreateEnum
CREATE TYPE "SalesFollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "sales_sequences" (
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "sales_enquiries" (
    "id" UUID NOT NULL,
    "enquiry_number" VARCHAR(20) NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "contact_person" VARCHAR(200),
    "contact_number" VARCHAR(50),
    "email" VARCHAR(254),
    "enquiry_date" DATE NOT NULL,
    "source" VARCHAR(100),
    "project_name" VARCHAR(300),
    "project_location" VARCHAR(300),
    "scope_of_work" TEXT NOT NULL,
    "type_of_work" VARCHAR(100),
    "estimated_value" DECIMAL(15,3),
    "estimated_value_source" VARCHAR(200),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KWD',
    "status" "SalesEnquiryStatus" NOT NULL DEFAULT 'NEW_ENQUIRY',
    "assigned_to_user_id" UUID,
    "next_follow_up_date" DATE,
    "remarks" TEXT,
    "additional_notes" TEXT,
    "expected_start_date" DATE,
    "expected_award_date" DATE,
    "lost_reason" VARCHAR(1000),
    "awarded_value" DECIMAL(15,3),
    "won_date" DATE,
    "lost_date" DATE,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_activities" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "type" "SalesActivityType" NOT NULL,
    "activity_date" DATE NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "recorded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_follow_ups" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "follow_up_date" DATE NOT NULL,
    "notes" VARCHAR(2000),
    "responsible_user_id" UUID,
    "status" "SalesFollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_user_id" UUID,
    "completion_notes" VARCHAR(2000),
    "rescheduled_from_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_enquiries_enquiry_number_key" ON "sales_enquiries"("enquiry_number");

-- CreateIndex
CREATE INDEX "sales_enquiries_status_enquiry_date_idx" ON "sales_enquiries"("status", "enquiry_date" DESC);

-- CreateIndex
CREATE INDEX "sales_enquiries_enquiry_date_idx" ON "sales_enquiries"("enquiry_date");

-- CreateIndex
CREATE INDEX "sales_enquiries_won_date_idx" ON "sales_enquiries"("won_date");

-- CreateIndex
CREATE INDEX "sales_enquiries_next_follow_up_date_idx" ON "sales_enquiries"("next_follow_up_date");

-- CreateIndex
CREATE INDEX "sales_enquiries_company_name_idx" ON "sales_enquiries"("company_name");

-- CreateIndex
CREATE INDEX "sales_enquiries_contact_number_idx" ON "sales_enquiries"("contact_number");

-- CreateIndex
CREATE INDEX "sales_enquiries_created_by_user_id_idx" ON "sales_enquiries"("created_by_user_id");

-- CreateIndex
CREATE INDEX "sales_activities_enquiry_id_created_at_idx" ON "sales_activities"("enquiry_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sales_follow_ups_status_follow_up_date_idx" ON "sales_follow_ups"("status", "follow_up_date");

-- CreateIndex
CREATE INDEX "sales_follow_ups_enquiry_id_status_idx" ON "sales_follow_ups"("enquiry_id", "status");

-- AddForeignKey
ALTER TABLE "sales_enquiries" ADD CONSTRAINT "sales_enquiries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_enquiries" ADD CONSTRAINT "sales_enquiries_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "sales_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_follow_ups" ADD CONSTRAINT "sales_follow_ups_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "sales_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_follow_ups" ADD CONSTRAINT "sales_follow_ups_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_follow_ups" ADD CONSTRAINT "sales_follow_ups_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_follow_ups" ADD CONSTRAINT "sales_follow_ups_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
VALUES
  (gen_random_uuid(), 'sales.read', 'View sales enquiries', 'View enquiries, follow-ups and the Sales dashboard.', 'sales', now()),
  (gen_random_uuid(), 'sales.create', 'Create sales enquiries', 'Register new client enquiries.', 'sales', now()),
  (gen_random_uuid(), 'sales.update', 'Update sales enquiries', 'Edit enquiries, record meetings, manage follow-ups and change enquiry status.', 'sales', now()),
  (gen_random_uuid(), 'sales.manage', 'Manage sales enquiries', 'Reassign an enquiry to another user.', 'sales', now()),
  (gen_random_uuid(), 'sales.reports.read', 'View sales reports', 'View monthly conversion and value reporting.', 'sales', now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'SALES_MANAGER', 'Sales Manager', 'Full access to Sales & Enquiries only. No operational or administration access.', true, true, now(), now()),
  (gen_random_uuid(), 'SALES_VIEWER', 'Sales Viewer', 'Read-only access to Sales & Enquiries and its reports. No operational or administration access.', true, true, now(), now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now() FROM "roles" r CROSS JOIN "permissions" p
WHERE (r.code = 'SALES_MANAGER' AND p.code IN ('sales.read','sales.create','sales.update','sales.manage','sales.reports.read'))
   OR (r.code = 'SALES_VIEWER' AND p.code IN ('sales.read','sales.reports.read'))
   OR (r.code = 'SUPER_ADMIN' AND p.code LIKE 'sales.%')
ON CONFLICT DO NOTHING;
