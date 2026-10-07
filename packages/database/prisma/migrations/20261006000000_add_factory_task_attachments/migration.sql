-- FMP-TASK-05 - Task Attachments.
-- Additive only: one new table, one new index, two new foreign keys.
-- Hand-written to match `prisma migrate diff` output for this model only
-- (the shadow database still fails `migrate dev` in this environment, per the
-- established workaround); unrelated pre-existing drift is deliberately excluded.

-- CreateTable
CREATE TABLE "factory_task_attachments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factory_task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "factory_task_attachments_task_id_created_at_idx" ON "factory_task_attachments"("task_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "factory_task_attachments" ADD CONSTRAINT "factory_task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "factory_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_task_attachments" ADD CONSTRAINT "factory_task_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
