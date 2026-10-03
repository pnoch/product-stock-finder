# Startup Env Validation — Design Spec

**Date:** 2026-10-02
**Goal:** Surface misconfigured server environment at startup — fail fast in production, warn in dev — instead of silently no-op'ing features.

## Problem

`server/_core/env.ts` already throws in production when `JWT_SECRET` is unset. But other required/optional config degrades silently:
- missing `DATABASE_URL` in production → `getDb()` returns null and every DB-backed feature (sync, auth, shared watchlists) no-ops with no signal;
- partially-configured optional features (VAPID web-push, OAuth, transactional email) just don't work;
- production with an empty `CORS_ALLOWED_ORIGINS` silently rejects the web origin.

## Design

New non-`_core` module `server/env-validation.ts`:

```ts
export type EnvIssueLevel = "error" | "warn";
export interface EnvIssue { level: EnvIssueLevel; message: string; }
export function validateServerEnv(env: NodeJS.ProcessEnv): EnvIssue[];
export function assertServerEnv(env?: NodeJS.ProcessEnv): void;
```

`validateServerEnv` (pure) checks:
- **error (production only):** `DATABASE_URL` unset/empty.
- **warn:** any feature group set *partially*. Groups are slot-based, and a slot may accept alternatives:
  - Google OAuth: `GOOGLE_CLIENT_ID` **or** `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, plus `GOOGLE_CLIENT_SECRET`.
  - Apple OAuth: `APPLE_CLIENT_ID` **or** `EXPO_PUBLIC_APPLE_CLIENT_ID`, plus `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.
  - Web push: `VAPID_SUBJECT` + `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`.
  - Email: `RESEND_API_KEY` + `EMAIL_FROM`.

**No CORS check.** The app's primary deploy serves `dist-web` same-origin (`server/spa.ts`), and `registerCors` only *adds* headers for allowlisted origins — an empty `CORS_ALLOWED_ORIGINS` is valid same-origin, so a production warning there is a false positive that trains operators to ignore the channel. (An earlier draft warned on it; removed.)

`assertServerEnv`:
- logs every issue (`console.error` for errors, `console.warn` for warnings);
- **throws** if any `error`-level issue exists (so a misconfigured production deploy fails at boot rather than half-working);
- never throws for warnings, and in non-production never throws at all (preserves local-only mode where the server runs with no DB).

**Wiring:** call `assertServerEnv()` once at the top of `startServer()` in `server/_core/index.ts` (one import + one call). This is a minimal infra extension of `_core`; no other `_core` change.

## Testing

- Unit tests (`tests/env-validation.test.ts`) for `validateServerEnv`, covering: `DATABASE_URL` missing (error in production, none in dev), each partial group → warn, complete groups → no issue, empty `CORS_ALLOWED_ORIGINS` in production → warn, and a fully-configured env → zero issues. `assertServerEnv` throws on a production error and does not throw for warnings/dev.
- Existing suites stay green; `tsc` 0; lint 0 (ratchet).

## Out of scope

- Client `EXPO_PUBLIC_*` (inlined at build; cannot meaningfully fail at runtime).
- `JWT_SECRET` (already enforced in `server/_core/env.ts`).
- Changing any feature's runtime fallback behavior.
