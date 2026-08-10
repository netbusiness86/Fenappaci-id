---
name: drizzle-kit push conflicts with existing tables
description: drizzle-kit push becomes interactive when existing DB tables conflict with new schema
---

## Rule
- When DB already has tables from a previous schema version, `drizzle-kit push` enters interactive mode asking to resolve conflicts — this hangs in CI/scripts
- Workaround: use `executeSql()` in CodeExecution to run `CREATE TABLE IF NOT EXISTS` directly

**Why:** drizzle-kit detects table renames or drops as potential data-loss operations and requires human confirmation.

**How to apply:** For new tables, always use `CREATE TABLE IF NOT EXISTS` via executeSql. For destructive changes (drops, renames), use `DROP TABLE IF EXISTS` + `CREATE TABLE IF NOT EXISTS` via executeSql, being careful about data loss.
