-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "plant_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "plants_code_key" ON "plants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE INDEX "locations_plant_id_idx" ON "locations"("plant_id");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Organization reference-data integrity constraints
ALTER TABLE "departments"
ADD CONSTRAINT "departments_code_format_check"
CHECK (
  "code" = upper("code")
  AND "code" ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'
);

ALTER TABLE "departments"
ADD CONSTRAINT "departments_name_not_blank_check"
CHECK (length(btrim("name")) > 0);

ALTER TABLE "plants"
ADD CONSTRAINT "plants_code_format_check"
CHECK (
  "code" = upper("code")
  AND "code" ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'
);

ALTER TABLE "plants"
ADD CONSTRAINT "plants_name_not_blank_check"
CHECK (length(btrim("name")) > 0);

ALTER TABLE "locations"
ADD CONSTRAINT "locations_code_format_check"
CHECK (
  "code" = upper("code")
  AND "code" ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'
);

ALTER TABLE "locations"
ADD CONSTRAINT "locations_name_not_blank_check"
CHECK (length(btrim("name")) > 0);
