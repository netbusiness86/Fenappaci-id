---
name: Session-based auth with express-session
description: How auth is implemented in the FENAPPACI API server (no JWT, session cookies)
---

## Rule
- Auth uses `express-session` (already installed in api-server)
- `SESSION_SECRET` secret is already provisioned in the workspace
- `custom-fetch.ts` in `lib/api-client-react` must have `credentials: 'include'` in the fetch call so session cookies are sent cross-origin
- CORS must have `credentials: true` and `origin: true` (not wildcard `*`)

**Why:** Browser same-origin policy blocks cookies on cross-origin fetch unless both `credentials: 'include'` (client) and `Access-Control-Allow-Credentials: true` (server) are set.

**How to apply:** When adding new auth-protected routes, check `req.session.userId` — it's set to the user's numeric id after login. The session module is extended in app.ts: `declare module 'express-session' { interface SessionData { userId: number; } }`

**Demo credentials:** All demo accounts use password `demo2026`. Emails: admin@fenappaci.ci, direction@fenappaci.ci, regional@fenappaci.ci, delegue@fenappaci.ci, sous-pref@fenappaci.ci, agent@fenappaci.ci
