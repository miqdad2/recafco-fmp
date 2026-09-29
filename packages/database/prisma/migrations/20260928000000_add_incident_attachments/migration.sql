-- FMP-INC-01 — Incident Evidence Attachments.
-- Additive only: one new table, one new index, two new foreign keys.
-- Hand-extracted from `prisma migrate diff --from-config-datasource --to-schema`
-- output (the shadow database still fails `migrate dev` in this
-- environment, per the established workaround) — the raw diff also
-- contained large amounts of unrelated pre-existing drift between the
-- live dev DB and migration history (FK/index renames on contract_*/
-- production_*/user_module_* tables from earlier Prisma version
-- upgrades), deliberately excluded here.

-- CreateTable
CREATE TABLE "incident_attachments" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_attachments_incident_id_created_at_idx" ON "incident_attachments"("incident_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "incident_attachments" ADD CONSTRAINT "incident_attachments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_attachments" ADD CONSTRAINT "incident_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
