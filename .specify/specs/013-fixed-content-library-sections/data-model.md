# Data Model: 013-fixed-content-library-sections

## Schema Changes

### Modified Table: `proposal_content_library`

One new column added:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| section_type | text, nullable | Nullable, indexed | Stable identifier for fixed sections (e.g., `company_info`, `company_contacts`). `NULL` for custom entries. |

**New composite index:** `(organization_id, section_type)` — enables fast lookup of all fixed sections for an org.

**Uniqueness constraint:** `UNIQUE (organization_id, section_type) WHERE section_type IS NOT NULL` — ensures exactly one row per fixed section per org. Custom entries (`section_type = NULL`) are not constrained.

### No New Tables

Fixed section definitions (identifier, display name, description, sort order) are stored as a TypeScript constant, not in the database. See research.md Decision 3.

---

## Fixed Section Definitions (TypeScript Constant)

```
FIXED_SECTIONS = [
  { sectionType: "company_info",     displayName: "Company Information", sortOrder: 1, description: "..." },
  { sectionType: "company_contacts", displayName: "Company Contacts",   sortOrder: 2, description: "..." },
  { sectionType: "services",         displayName: "Services",           sortOrder: 3, description: "..." },
  { sectionType: "specialties",      displayName: "Specialties",        sortOrder: 4, description: "..." },
  { sectionType: "certifications",   displayName: "Certifications",     sortOrder: 5, description: "..." },
  { sectionType: "past_performance", displayName: "Past Performance",   sortOrder: 6, description: "..." },
]
```

---

## Row Examples

### Fixed section (populated)
```
id:              uuid-1
organization_id: org_abc
category:        "Company Information"   (display name, for backward compat with search)
name:            "Company Information"   (same as display name)
content:         "Acme Solutions is..."  (user-entered)
section_type:    "company_info"          (stable identifier — NEW)
embedding:       [0.01, 0.02, ...]
created_by:      "system"
```

### Fixed section (empty — just initialized)
```
id:              uuid-2
organization_id: org_abc
category:        "Company Contacts"
name:            "Company Contacts"
content:         ""                      (empty — UI shows guidance text)
section_type:    "company_contacts"
embedding:       NULL
created_by:      "system"
```

### Custom entry (unchanged)
```
id:              uuid-3
organization_id: org_abc
category:        "SLA Terms"
name:            "Standard SLA"
content:         "Response & Resolution..."
section_type:    NULL                    (NULL = custom)
embedding:       [0.03, 0.04, ...]
created_by:      "user_xyz"
```

---

## Query Patterns

### Fetch all fixed sections for an org
```sql
SELECT * FROM proposal_content_library
WHERE organization_id = ? AND section_type IS NOT NULL
ORDER BY section_type
```

### Fetch a specific fixed section
```sql
SELECT * FROM proposal_content_library
WHERE organization_id = ? AND section_type = 'company_info'
LIMIT 1
```

### Fetch only custom entries (for semantic search)
```sql
SELECT * FROM proposal_content_library
WHERE organization_id = ? AND section_type IS NULL
```

### Lazy init — find missing sections
```sql
-- App logic: compare existing section_types against FIXED_SECTIONS constant
-- Insert missing ones with empty content
SELECT section_type FROM proposal_content_library
WHERE organization_id = ? AND section_type IS NOT NULL
```

---

## Migration Strategy

- **Type:** Additive only (new nullable column + index + partial unique constraint)
- **Existing rows:** Unaffected — `section_type` defaults to `NULL`
- **Downtime:** None — nullable column add is non-blocking
- **Rollback:** Drop column (safe — no data loss for existing entries)
