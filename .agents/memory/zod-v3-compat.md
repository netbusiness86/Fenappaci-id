---
name: Zod v3 OpenAPI compatibility
description: Constraints when generating Zod schemas from OpenAPI spec using Orval + Zod v3
---

## Rule
- Never use `format: email` in OpenAPI spec — Orval generates `zod.email()` which does not exist in Zod v3
- Never use `type: integer` — generates `zod.int()` which does not exist in Zod v3; use `type: number` instead
- All other `format:` values (date, date-time, uuid) should be tested before using

**Why:** The workspace uses Zod v3 (not Zod v4). Orval generates v4 syntax for email/integer types, causing TypeScript build errors.

**How to apply:** Before running codegen, review all field types in openapi.yaml for integer and email format fields and remove/replace them.
