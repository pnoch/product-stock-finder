# Startup Env Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure server env validator and call it at startup so a misconfigured production deploy fails fast (and dev/optional gaps warn) instead of silently no-op'ing features.

**Architecture:** A new non-`_core` `server/env-validation.ts` exports a pure `validateServerEnv` plus a thin `assertServerEnv` (logs, throws only on production errors). `server/_core/index.ts` calls it once at the top of `startServer()`.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-startup-env-validation-design.md`

---

## Task 1: `server/env-validation.ts` + tests

**Files:**
- Create: `server/env-validation.ts`
- Test: `tests/env-validation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/env-validation.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertServerEnv, validateServerEnv } from "../server/env-validation";

afterEach(() => vi.restoreAllMocks());

describe("validateServerEnv", () => {
  it("errors on missing DATABASE_URL only in production", () => {
    expect(validateServerEnv({ NODE_ENV: "production" }).some((i) => i.level === "error")).toBe(true);
    expect(validateServerEnv({ NODE_ENV: "development" }).some((i) => i.level === "error")).toBe(false);
  });

  it("warns on empty CORS_ALLOWED_ORIGINS in production", () => {
    const issues = validateServerEnv({ NODE_ENV: "production", DATABASE_URL: "mysql://x" });
    expect(issues).toEqual([
      expect.objectContaining({ level: "warn", message: expect.stringContaining("CORS_ALLOWED_ORIGINS") }),
    ]);
  });

  it("warns on each partially-configured group", () => {
    const issues = validateServerEnv({
      NODE_ENV: "development",
      GOOGLE_CLIENT_ID: "a",
      APPLE_CLIENT_ID: "b",
      VAPID_SUBJECT: "c",
      RESEND_API_KEY: "d",
    });
    const labels = issues.map((i) => i.message);
    expect(labels).toHaveLength(4);
    expect(labels.join(" ")).toContain("Google OAuth");
    expect(labels.join(" ")).toContain("Apple OAuth");
    expect(labels.join(" ")).toContain("VAPID");
    expect(labels.join(" ")).toContain("email");
  });

  it("is silent when groups are complete or absent", () => {
    expect(
      validateServerEnv({
        NODE_ENV: "production",
        DATABASE_URL: "mysql://x",
        CORS_ALLOWED_ORIGINS: "https://app.example.com",
        GOOGLE_CLIENT_ID: "a",
        GOOGLE_CLIENT_SECRET: "b",
        VAPID_SUBJECT: "mailto:x@y",
        VAPID_PUBLIC_KEY: "p",
        VAPID_PRIVATE_KEY: "s",
        RESEND_API_KEY: "r",
        EMAIL_FROM: "a@b.c",
      }),
    ).toEqual([]);
  });
});

describe("assertServerEnv", () => {
  it("throws in production when required env is missing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => assertServerEnv({ NODE_ENV: "production" })).toThrow(/environment validation failed/i);
  });

  it("never throws for warnings or in development", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertServerEnv({ NODE_ENV: "development", VAPID_SUBJECT: "x" })).not.toThrow();
    expect(() => assertServerEnv({ NODE_ENV: "development" })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/env-validation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `server/env-validation.ts`**

```ts
export type EnvIssueLevel = "error" | "warn";

export interface EnvIssue {
  level: EnvIssueLevel;
  message: string;
}

function has(env: NodeJS.ProcessEnv, key: string): boolean {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0;
}

function partialGroup(
  env: NodeJS.ProcessEnv,
  label: string,
  keys: string[],
): EnvIssue | null {
  const present = keys.filter((key) => has(env, key));
  if (present.length === 0 || present.length === keys.length) return null;
  const missing = keys.filter((key) => !has(env, key));
  return {
    level: "warn",
    message: `${label} is only partially configured; missing ${missing.join(", ")}`,
  };
}

const FEATURE_GROUPS: Array<[string, string[]]> = [
  ["Google OAuth", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]],
  ["Apple OAuth", ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"]],
  ["Web push (VAPID)", ["VAPID_SUBJECT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]],
  ["Transactional email", ["RESEND_API_KEY", "EMAIL_FROM"]],
];

/**
 * Pure check of the server environment. Production-only problems are `error`
 * (a misconfigured deploy must fail at boot); everything else is a `warn` so
 * local-only mode still runs with no server config.
 */
export function validateServerEnv(env: NodeJS.ProcessEnv): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProduction = env.NODE_ENV === "production";

  if (isProduction && !has(env, "DATABASE_URL")) {
    issues.push({
      level: "error",
      message: "DATABASE_URL must be set in production (sync, auth and shares are disabled without it)",
    });
  }
  if (isProduction && !has(env, "CORS_ALLOWED_ORIGINS")) {
    issues.push({
      level: "warn",
      message: "CORS_ALLOWED_ORIGINS is empty in production; the web origin will be rejected",
    });
  }
  for (const [label, keys] of FEATURE_GROUPS) {
    const issue = partialGroup(env, label, keys);
    if (issue) issues.push(issue);
  }
  return issues;
}

/** Logs every issue; throws only when a production `error` is present. */
export function assertServerEnv(env: NodeJS.ProcessEnv = process.env): void {
  let hasError = false;
  for (const issue of validateServerEnv(env)) {
    if (issue.level === "error") {
      hasError = true;
      console.error(`[env] ${issue.message}`);
    } else {
      console.warn(`[env] ${issue.message}`);
    }
  }
  if (hasError) {
    throw new Error("Server environment validation failed (see [env] errors above)");
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/env-validation.test.ts && pnpm check`
Expected: PASS, 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add server/env-validation.ts tests/env-validation.test.ts
git commit -m "feat: add pure server env validator"
```

---

## Task 2: Wire at startup + verify

**Files:**
- Modify: `server/_core/index.ts` (top of `startServer()`; `_core` is normally hands-off — this one import + call is a deliberate infra extension)
- Modify: `todo.md`

- [ ] **Step 1: Wire the call**

In `server/_core/index.ts`, add near the other imports:
```ts
import { assertServerEnv } from "../env-validation";
```
and make it the first statement in `async function startServer()`:
```ts
async function startServer() {
  assertServerEnv();
  const app = express();
  // …unchanged…
```
Do not change anything else in the file.

- [ ] **Step 2: Verify**

Run: `pnpm check && pnpm lint && pnpm test && pnpm check:desktop && pnpm --dir desktop test`
Expected: all green; lint 0 warnings (ratchet); `tests/env-validation.test.ts` passes.

- [ ] **Step 3: Append the phase entry**

```md
## Phase 1052: Startup env validation

- [x] New pure `server/env-validation.ts` (`validateServerEnv` + `assertServerEnv`): production-missing `DATABASE_URL` is a fatal `error`; empty production `CORS_ALLOWED_ORIGINS` and partially-configured Google/Apple OAuth, VAPID, or email groups warn. Dev/optional gaps never throw, preserving local-only mode. `JWT_SECRET` was already enforced in `server/_core/env.ts`.
- [x] Called once at the top of `startServer()` in `server/_core/index.ts` (minimal `_core` infra extension). Unit tests cover each error/warn case and the throw/no-throw contract. `tsc 0`, lint 0 warnings, suites green.
```

- [ ] **Step 4: Commit**

```bash
git add server/_core/index.ts todo.md
git commit -m "feat: validate server env at startup (Phase 1052)"
```
