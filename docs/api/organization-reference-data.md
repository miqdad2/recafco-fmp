# API Reference — Organization Reference Data

Unit 04. Base path: `/organizations`. Three sub-resources: `departments`, `plants`, `locations`.

All responses follow the envelope shape:
```json
{ "data": <T | null>, "meta": { "requestId": "<uuid>" }, "error": <ErrorObject | null> }
```

---

## Common Response Types

### OrgEntity (Departments and Plants)

```typescript
{
  id: string;            // UUID
  code: string;          // 2–32 uppercase alphanumeric, hyphen, underscore
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;     // ISO 8601 UTC
  updatedAt: string;
}
```

### LocationEntity

Same as OrgEntity plus:
```typescript
{
  plantId: string | null;
  plant: { id: string; code: string; name: string } | null;
}
```

### Paginated List Response

```typescript
{
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

---

## Common Error Codes

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO validation failure; `details.fields` maps field → message array |
| 400 | `INVALID_PLANT_ID` | Supplied `plantId` does not reference an existing plant (locations only) |
| 404 | `NOT_FOUND` | Record with supplied UUID does not exist |
| 409 | `DUPLICATE_CODE` | `code` already exists in this entity's table |
| 503 | `AUTH_NOT_IMPLEMENTED` | Mutation endpoint called in production environment (auth not yet wired) |

---

## Departments

### GET /organizations/departments

List departments with optional filtering and pagination.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | 1 | Page number |
| `pageSize` | integer 1–100 | 20 | Items per page |
| `search` | string | — | Case-insensitive substring match on `name` or `code` |
| `isActive` | boolean | — | Filter by active state |

**Response 200:**
```json
{
  "data": {
    "items": [ /* OrgEntity[] */ ],
    "pagination": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 }
  },
  "meta": { "requestId": "..." },
  "error": null
}
```

Results are always ordered by `code ASC`.

---

### GET /organizations/departments/:id

Retrieve a single department by UUID.

**Response 200:** `data` is an `OrgEntity`.
**Response 400:** Invalid UUID format → `VALIDATION_ERROR`.
**Response 404:** Department not found → `NOT_FOUND`.

---

### POST /organizations/departments

Create a department. Guarded by `PendingAuthGuard` — returns 503 in production until authentication is implemented.

**Request body:**
```json
{
  "code": "PROD",
  "name": "Production",
  "description": "Optional"
}
```

| Field | Required | Rules |
|---|---|---|
| `code` | YES | 2–32 chars; normalized to uppercase trim before validation |
| `name` | YES | 1–200 chars; trimmed |
| `description` | NO | max 500 chars; trimmed |

**Response 201:** `data` is the created `OrgEntity`.

---

### PATCH /organizations/departments/:id

Partially update a department. All fields optional. `PendingAuthGuard` applies.

**Request body:** same shape as POST; all fields optional.

**Response 200:** `data` is the updated `OrgEntity`.

---

### POST /organizations/departments/:id/activate

Set `isActive = true`. Idempotent — calling on an already-active department succeeds.

**Response 200:** `data` is the updated `OrgEntity`.

---

### POST /organizations/departments/:id/deactivate

Set `isActive = false`. Idempotent.

**Response 200:** `data` is the updated `OrgEntity`.

---

## Plants

All plant endpoints follow the same shape as Departments with the base path `/organizations/plants`.

Routes:
- `GET /organizations/plants`
- `GET /organizations/plants/:id`
- `POST /organizations/plants`
- `PATCH /organizations/plants/:id`
- `POST /organizations/plants/:id/activate`
- `POST /organizations/plants/:id/deactivate`

Request/response types are identical to the Department counterparts.

---

## Locations

### GET /organizations/locations

**Additional query parameter:**

| Param | Type | Default | Description |
|---|---|---|---|
| `plantId` | UUID | — | Filter locations by plant (includes unassigned if omitted) |

**Response 200:** `data.items` is `LocationEntity[]` — each item includes the nested `plant` object (or `null`).

---

### GET /organizations/locations/:id

**Response 200:** `data` is a `LocationEntity` with nested `plant`.

---

### POST /organizations/locations

**Request body:**
```json
{
  "code": "WH-A1",
  "name": "Warehouse A — Bay 1",
  "description": "Optional",
  "plantId": "uuid-of-plant"
}
```

| Field | Required | Rules |
|---|---|---|
| `code` | YES | 2–32 chars; normalized to uppercase |
| `name` | YES | 1–200 chars |
| `description` | NO | max 500 chars |
| `plantId` | NO | UUID v4; must reference an existing plant if supplied; null/absent = no plant |

If `plantId` is supplied and does not reference an existing plant, returns 400 `INVALID_PLANT_ID`.

---

### PATCH /organizations/locations/:id

To **remove** a plant association, send `"plantId": null` explicitly. Omitting `plantId` leaves the current value unchanged (standard partial-update semantics).

---

### POST /organizations/locations/:id/activate
### POST /organizations/locations/:id/deactivate

Same behavior as the department/plant equivalents.

---

## Validation Error Shape

```json
{
  "data": null,
  "meta": { "requestId": "..." },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "code": ["code must match /^[A-Z0-9_-]{2,32}$/"],
        "name": ["name should not be empty"]
      }
    }
  }
}
```
