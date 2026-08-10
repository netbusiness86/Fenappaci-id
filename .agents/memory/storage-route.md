---
name: Storage route cannot import from api-zod
description: The storage.ts route must not import generated Zod schemas that may not exist
---

## Rule
- `artifacts/api-server/src/routes/storage.ts` must use plain TypeScript/JS validation, NOT import from `@workspace/api-zod`
- The generated schemas in api-zod only exist for endpoints defined in openapi.yaml; the storage endpoint is NOT in the spec
- Use `const { name, size, contentType } = req.body ?? {}` with a simple `typeof` check

**Why:** If the storage endpoint is not in openapi.yaml, no Zod schemas are generated for it. Importing non-existent exports causes build failure (esbuild error: "No matching export").

**How to apply:** Any time openapi.yaml is regenerated, check that storage.ts imports are still valid. If storage endpoints are added to the spec, the generated schemas can then be imported.
