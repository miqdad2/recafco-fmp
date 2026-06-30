# Data Dictionary — Organization Reference Data

Unit 04. Covers the three organization reference tables: `departments`, `plants`, and `locations`.

---

## Table: `departments`

Company-wide classification used to associate personnel, tasks, and records with a business unit. Flat — no parent/child hierarchy.

| Column | PG Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Surrogate key |
| `code` | `varchar(32)` | NO | — | UNIQUE, CHECK | 2–32 chars, uppercase alphanumeric, hyphen, underscore (`^[A-Z0-9_-]{2,32}$`) |
| `name` | `varchar(200)` | NO | — | CHECK | Non-empty human-readable label |
| `description` | `varchar(500)` | YES | NULL | — | Optional longer description |
| `is_active` | `boolean` | NO | `true` | — | Soft enable/disable; deactivated records remain queryable |
| `created_at` | `timestamptz(3)` | NO | `now()` | — | Creation timestamp (millisecond precision, UTC) |
| `updated_at` | `timestamptz(3)` | NO | — | — | Last update timestamp (auto-managed by Prisma) |

**Indexes:**
- Primary key on `id`
- Unique on `code`

**Prisma model:** `Department`
**API routes:** `/organizations/departments`

---

## Table: `plants`

Physical or logical manufacturing facility. Flat — no parent/child hierarchy. Locations may optionally reference a plant.

| Column | PG Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Surrogate key |
| `code` | `varchar(32)` | NO | — | UNIQUE, CHECK | 2–32 chars, uppercase alphanumeric, hyphen, underscore |
| `name` | `varchar(200)` | NO | — | CHECK | Non-empty human-readable label |
| `description` | `varchar(500)` | YES | NULL | — | Optional longer description |
| `is_active` | `boolean` | NO | `true` | — | Soft enable/disable |
| `created_at` | `timestamptz(3)` | NO | `now()` | — | Creation timestamp |
| `updated_at` | `timestamptz(3)` | NO | — | — | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Unique on `code`

**Prisma model:** `Plant`
**API routes:** `/organizations/plants`

---

## Table: `locations`

Physical or logical area within (or independent of) a plant — e.g., a warehouse bay, production line, or storage room. `plant_id` is nullable: a location need not belong to a plant.

| Column | PG Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Surrogate key |
| `code` | `varchar(32)` | NO | — | UNIQUE, CHECK | 2–32 chars, uppercase alphanumeric, hyphen, underscore |
| `name` | `varchar(200)` | NO | — | CHECK | Non-empty human-readable label |
| `description` | `varchar(500)` | YES | NULL | — | Optional longer description |
| `plant_id` | `uuid` | YES | NULL | FK → `plants.id` ON DELETE RESTRICT | Optional plant association; RESTRICT prevents deleting a plant that owns locations |
| `is_active` | `boolean` | NO | `true` | — | Soft enable/disable |
| `created_at` | `timestamptz(3)` | NO | `now()` | — | Creation timestamp |
| `updated_at` | `timestamptz(3)` | NO | — | — | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Unique on `code`
- `idx_locations_plant_id` on `plant_id` (supports FK lookups and plant filter queries)

**Prisma model:** `Location`
**API routes:** `/organizations/locations`

---

## Code Field Rules

Applies equally to `departments.code`, `plants.code`, and `locations.code`:

- Pattern: `^[A-Z0-9_-]{2,32}$`
- Normalized at API ingestion: trimmed and uppercased before persistence
- Once created, `code` is immutable via the standard update endpoint (field is accepted but ignored for partial-update operations; a dedicated rename endpoint would be required to change a code, and none exists in this unit)
- Uniqueness enforced at the database level; API catches P2002 and returns 409 DUPLICATE_CODE

## Lifecycle

All three entities use soft-delete semantics:
- `is_active = true` — record is in use
- `is_active = false` — record is deactivated; retains all history and foreign key references
- No hard-delete endpoint exists; records are never physically removed

## Expected Migration SQL

The migration for this unit cannot be run automatically (no `.env` configured). The SQL to be applied when database access is granted:

```sql
-- departments
CREATE TABLE "departments" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"        VARCHAR(32) NOT NULL,
  "name"        VARCHAR(200) NOT NULL,
  "description" VARCHAR(500),
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
ALTER TABLE "departments"
  ADD CONSTRAINT "departments_code_format"
    CHECK (code ~ '^[A-Z0-9_\-]{2,32}$'),
  ADD CONSTRAINT "departments_name_nonempty"
    CHECK (length(trim(name)) > 0);

-- plants
CREATE TABLE "plants" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"        VARCHAR(32) NOT NULL,
  "name"        VARCHAR(200) NOT NULL,
  "description" VARCHAR(500),
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plants_code_key" ON "plants"("code");
ALTER TABLE "plants"
  ADD CONSTRAINT "plants_code_format"
    CHECK (code ~ '^[A-Z0-9_\-]{2,32}$'),
  ADD CONSTRAINT "plants_name_nonempty"
    CHECK (length(trim(name)) > 0);

-- locations
CREATE TABLE "locations" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"        VARCHAR(32) NOT NULL,
  "name"        VARCHAR(200) NOT NULL,
  "description" VARCHAR(500),
  "plant_id"    UUID,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");
CREATE INDEX "locations_plant_id_idx" ON "locations"("plant_id");
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_plant_id_fkey"
    FOREIGN KEY ("plant_id") REFERENCES "plants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "locations_code_format"
    CHECK (code ~ '^[A-Z0-9_\-]{2,32}$'),
  ADD CONSTRAINT "locations_name_nonempty"
    CHECK (length(trim(name)) > 0);
```
