# User-Scoped Device Revocation v4.4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope device revocation to `(userId, deviceId)` so that one account's login/sign-out no longer affects another account on a shared device, while keeping legacy pre-v4.4 rows as NULL-userId global blocks.

**Architecture:** Add a `userId` column to the `revoked_devices` table (surrogate `id` PK + unique index on `(userId, deviceId)`); change `isDeviceRevoked`/`unrevokeDevice` to take a `userId` and match `userId = ? OR userId IS NULL`; `signOutDevice` stores the user; `context.ts` passes `user.id`; the OAuth handlers pass the synced user's numeric id. Memory backend mirrors this with composite keys (`${userId}:${deviceId}` plus `*:${deviceId}` for a global block).

**Tech Stack:** Drizzle (MySQL), Express + tRPC, jose, vitest, pnpm.

---

### Task 1: Schema — `revoked_devices` gains userId

**Files:**
- Modify: `drizzle/schema.ts:226-229`
- Generate: `drizzle/0012_*.sql` + `drizzle/meta/0012_snapshot.json` + `drizzle/meta/_journal.json`

- [ ] **Step 1: Update the schema**

In `drizzle/schema.ts`, add `uniqueIndex` to the import from `drizzle-orm/mysql-core` (top of file). The current import block ends with `varchar,` — the full list becomes:

```ts
import {
  bigint,
  double,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
```

Replace the current `revokedDevices` definition (lines ~226-229):

```ts
export const revokedDevices = mysqlTable(
  "revoked_devices",
  {
    id: int("id").autoincrement().primaryKey(),
    deviceId: varchar("deviceId", { length: 128 }).notNull(),
    userId: int("userId"),
    revokedAt: bigint("revokedAt", { mode: "number" }).notNull(),
  },
  (t) => ({
    uniqUserDevice: uniqueIndex("revoked_devices_user_device").on(
      t.userId,
      t.deviceId,
    ),
  }),
);
```

- [ ] **Step 2: Generate the migration**

The drizzle config (`drizzle.config.ts`) requires `DATABASE_URL` to load, but `generate` does NOT connect to a database — it diffs the schema against the journal snapshots. Provide a dummy URL:

```bash
DATABASE_URL="mysql://user:pass@localhost:3306/product_stock_finder" pnpm exec drizzle-kit generate
```

Expected: creates `drizzle/0012_<name>.sql`, updates `drizzle/meta/0012_snapshot.json` and `_journal.json`. Open the generated SQL and confirm it contains all of: `ADD` of an auto-increment `id` PK, `ADD` of `userId`, `DROP PRIMARY KEY` (the old `deviceId` PK), and a `CREATE UNIQUE INDEX` on `(userId, deviceId)`. If `drizzle-kit` emits an error about the table rename/breakpoints, verify the SQL is still a valid forward migration by hand — the exact statement order may vary.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0. (The insert in `server/devices.ts` still compiles because `userId` is optional in the insert type and `id` is auto-increment.)

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0012_*.sql drizzle/meta/_journal.json drizzle/meta/0012_snapshot.json
git commit -m "feat(devices): add userId scoping to revoked_devices schema"
```

---

### Task 2: User-scoped revocation in server/devices.ts

**Files:**
- Modify: `server/devices.ts:1,18-19,189-243`
- Test: `tests/devices.test.ts`

- [ ] **Step 1: Update the failing tests**

In `tests/devices.test.ts`, update every call site to pass a `userId`:

- Line 156: `expect(await isDeviceRevoked(7, "dev-1")).toBe(true);`
- Line 162: `expect(await isDeviceRevoked(7, "dev-1")).toBe(false);`
- Line 169: `expect(await isDeviceRevoked(7, "dev-1")).toBe(false);`
- Lines 175-177: `expect(await isDeviceRevoked(7, "dev-1")).toBe(true);` / `await unrevokeDevice(7, "dev-1");` / `expect(await isDeviceRevoked(7, "dev-1")).toBe(false);`
- Lines 181-182: `await unrevokeDevice(7, "dev-1");` / `expect(await isDeviceRevoked(7, "dev-1")).toBe(false);`
- Line 199: `expect(await isDeviceRevoked(7, "dev-1")).toBe(false);`
- Line 389: `await unrevokeDevice(7, "dev-1");`
- Line 476-477: `expect(await isDeviceRevoked(7, "dev-1")).toBe(true);` / `expect(await isDeviceRevoked(7, "dev-2")).toBe(false);`

Add these two cross-user tests to the `describe("devices (memory backend)")` block, after the "un-revoking a clean device is a no-op" test (line ~183):

```ts
  it("revokes only the signing-out user on a shared device", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await signOutDevice(7, "dev-1");
    expect(await isDeviceRevoked(7, "dev-1")).toBe(true);
    expect(await isDeviceRevoked(8, "dev-1")).toBe(false);
  });

  it("un-revoking one user does not clear another user's revocation", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await signOutDevice(7, "dev-1");
    await unrevokeDevice(8, "dev-1");
    expect(await isDeviceRevoked(7, "dev-1")).toBe(true);
    await unrevokeDevice(7, "dev-1");
    expect(await isDeviceRevoked(7, "dev-1")).toBe(false);
  });
```

Replace the DB-backend "checks revocation in the database" test (lines ~452-479) — the current stub inspects `condition.queryChunks` flat, which breaks with the nested `and(eq(...), or(...))`:

```ts
  it("checks revocation in the database scoped to the user", async () => {
    const findDeviceId = (node: unknown, target: string): boolean => {
      if (!node || typeof node !== "object") return false;
      const obj = node as Record<string, unknown>;
      if (obj.value === target) return true;
      return Object.values(obj).some((child) => findDeviceId(child, target));
    };
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === revokedDevices) {
            return {
              where: vi.fn(async (condition: unknown) =>
                findDeviceId(condition, "dev-1")
                  ? [
                      {
                        id: 1,
                        deviceId: "dev-1",
                        userId: 7,
                        revokedAt: Date.now(),
                      },
                    ]
                  : [],
              ),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await isDeviceRevoked(7, "dev-1")).toBe(true);
    expect(await isDeviceRevoked(7, "dev-2")).toBe(false);
    mockedGetDb.mockResolvedValue(null);
  });

  it("treats a legacy NULL userId row as a global block", async () => {
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === revokedDevices) {
            return {
              where: vi.fn(async () => [
                {
                  id: 1,
                  deviceId: "dev-1",
                  userId: null,
                  revokedAt: Date.now(),
                },
              ]),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await isDeviceRevoked(7, "dev-1")).toBe(true);
    expect(await isDeviceRevoked(8, "dev-1")).toBe(true);
    mockedGetDb.mockResolvedValue(null);
  });
```

> **Code-review note:** The DB scoping tests assert the `userId = ? OR userId IS NULL` clauses directly. The "scoped to the user" stub returns a row only when the condition tree contains the deviceId literal AND (the caller's numeric userId OR an `is null` term); the "legacy NULL" stub returns a row only when the `is null` term is present (detected via the `" is null"` SQL string fragment, which survives across drizzle versions). The tree-search helpers use a visited-set guard because drizzle's condition graph is cyclic (`column.table.columns`). The "un-revoking deletes the caller's row" test was redundant with the pre-existing "un-revokes by deleting the revoked_devices row" test and is intentionally omitted.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/devices.test.ts`
Expected: FAIL — `Expected 2 arguments, but got 1` type errors / `isDeviceRevoked` called with wrong arity; the new cross-user tests fail because revocation is still global.

- [ ] **Step 3: Update the import**

In `server/devices.ts`, change line 1:

```ts
import { and, eq, isNull, or } from "drizzle-orm";
```

- [ ] **Step 4: Update signOutDevice (insert stores the user)**

In `server/devices.ts`, the memory branch of `signOutDevice` (lines ~196-199) becomes:

```ts
  if (!db) {
    memoryRevokedDevices.add(`${userId}:${deviceId}`);
    memoryLabels.delete(deviceId);
    return true;
  }
```

The DB branch (lines ~201-204) becomes:

```ts
  await db
    .insert(revokedDevices)
    .values({ deviceId, userId, revokedAt: Date.now() })
    .onDuplicateKeyUpdate({ set: { revokedAt: Date.now() } });
  await db.delete(deviceLabels).where(eq(deviceLabels.deviceId, deviceId));
  return true;
```

- [ ] **Step 5: Update unrevokeDevice**

Replace `unrevokeDevice` (lines ~209-216):

```ts
export async function unrevokeDevice(
  userId: number,
  deviceId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryRevokedDevices.delete(`${userId}:${deviceId}`);
    memoryRevokedDevices.delete(`*:${deviceId}`);
    return;
  }
  await db
    .delete(revokedDevices)
    .where(
      and(
        eq(revokedDevices.deviceId, deviceId),
        or(eq(revokedDevices.userId, userId), isNull(revokedDevices.userId)),
      ),
    );
}
```

- [ ] **Step 6: Update isDeviceRevoked**

Replace `isDeviceRevoked` (lines ~235-243):

```ts
export async function isDeviceRevoked(
  userId: number,
  deviceId: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return (
      memoryRevokedDevices.has(`${userId}:${deviceId}`) ||
      memoryRevokedDevices.has(`*:${deviceId}`)
    );
  }
  const rows = await db
    .select()
    .from(revokedDevices)
    .where(
      and(
        eq(revokedDevices.deviceId, deviceId),
        or(eq(revokedDevices.userId, userId), isNull(revokedDevices.userId)),
      ),
    );
  return rows.length > 0;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test tests/devices.test.ts`
Expected: PASS (all memory + DB backend tests, including the new cross-user and NULL-row tests).

- [ ] **Step 8: Run typecheck + full suite**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0. (This will surface the now-broken callers in `context.ts` and `oauth.ts` — that's expected. If it fails only on those, proceed to Tasks 3 and 4 to fix them; do NOT leave the tree with errors.)

- [ ] **Step 9: Commit**

```bash
git add server/devices.ts tests/devices.test.ts
git commit -m "feat(devices): scope revocation to (userId, deviceId) with legacy NULL global block"
```

---

### Task 3: Claim-authoritative check scoped to the user in context.ts

**Files:**
- Modify: `server/_core/context.ts:32`
- Test: `tests/device-revoked.test.ts`

- [ ] **Step 1: Update the failing tests**

In `tests/device-revoked.test.ts`, add argument assertions to the existing `createContext revocation check` tests (the mocked `isDeviceRevoked` already exists at line 10 and is imported at line 23):

- In "throws DEVICE_REVOKED based on the token claim even when the header is absent" (line ~86), add after the `rejects` block:
```ts
    expect(mockedRevoked).toHaveBeenCalledWith(7, "dev-claim");
```
- In "prefers the token claim over the header for ctx.deviceId" (line ~100), add:
```ts
    expect(mockedRevoked).toHaveBeenCalledWith(7, "dev-claim");
```
- In "falls back to the header when the token has no deviceId claim" (line ~113), add:
```ts
    expect(mockedRevoked).toHaveBeenCalledWith(7, "dev-header");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/device-revoked.test.ts`
Expected: FAIL — the assertion `toHaveBeenCalledWith(7, "dev-claim")` fails because context.ts still calls `isDeviceRevoked(effectiveDeviceId)` with one argument.

- [ ] **Step 3: Pass user.id to the revocation check**

In `server/_core/context.ts`, line 32, change:

```ts
    const revoked = await isDeviceRevoked(effectiveDeviceId);
```

to:

```ts
    const revoked = await isDeviceRevoked(user.id, effectiveDeviceId);
```

(The enclosing `if (effectiveDeviceId && user)` guard already narrows `user` to non-null.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/device-revoked.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck + related router tests**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0 (only remaining error should be in `server/_core/oauth.ts`, fixed in Task 4).

Run: `pnpm test tests/devices-router.test.ts tests/auth.logout.test.ts tests/notifications-router.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/_core/context.ts tests/device-revoked.test.ts
git commit -m "feat(auth): scope the revocation check to the authenticated user"
```

---

### Task 4: OAuth login un-revokes the synced user's device

**Files:**
- Modify: `server/_core/oauth.ts:76-92,122-138`
- Test: `tests/oauth-handlers.test.ts`

- [ ] **Step 1: Update the failing tests**

First, the critical prerequisite: `vi.resetAllMocks()` in each `beforeEach` **wipes the module-factory implementation**, so `getUserByOpenId` returns `undefined` on its own (verified empirically). `syncUser` then returns a fallback object with **no numeric `id`**, which would make the new `toHaveBeenCalledWith(1, "dev-1")` assertions fail and would silently skip un-revoke. So both `beforeEach` blocks (web at line ~101, mobile at line ~229) must gain an explicit default after the `vi.resetAllMocks()` line:

```ts
  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetUser.mockResolvedValue({
      id: 1,
      openId: "open-1",
      name: "U",
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
  });
```

The factory mock at line ~14 is now redundant but harmless — leave it (it is the pre-reset default). With the `beforeEach` default in place, `syncUser` resolves `id: 1` and the following assertion updates are correct:

- Web deviceId test: change `expect(mockedUnrevoke).toHaveBeenCalledWith("dev-1")` to:
```ts
    expect(mockedUnrevoke).toHaveBeenCalledWith(1, "dev-1");
```
- Web legacy-state test: keep `expect(mockedUnrevoke).not.toHaveBeenCalled();` — unchanged.
- Web un-revoke-throws test: change to `expect(mockedUnrevoke).toHaveBeenCalledWith(1, "dev-1");` (the call is still attempted).
- Mobile deviceId test: change to `expect(mockedUnrevoke).toHaveBeenCalledWith(1, "dev-1");`.
- Mobile un-revoke-throws test: change to `expect(mockedUnrevoke).toHaveBeenCalledWith(1, "dev-1");`.

Add a new test to the web section proving the no-DB fallback path (when `getUserByOpenId` returns undefined, `syncUser` returns a fallback object without an `id`, so un-revoke is skipped with a warning but login still succeeds):

```ts
  it("skips un-revoke when no numeric user id resolves", async () => {
    mockedExchange.mockResolvedValue({ accessToken: "at" } as any);
    mockedGetUserInfo.mockResolvedValue({ openId: "open-1", name: "U" } as any);
    mockedGetUser.mockResolvedValue(undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const getHandler = setupRoutes();
    const res = makeRes();
    await getHandler("GET", WEB_CALLBACK)(
      makeReq({
        code: "c",
        state: encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1"),
      }),
      res,
    );
    expect(mockedUnrevoke).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[OAuth] Skipping un-revoke: no numeric user id",
    );
    expect(mockedCreateToken).toHaveBeenCalledWith(
      "open-1",
      expect.objectContaining({ deviceId: "dev-1" }),
    );
  });
```

Note: `setupRoutes()` returns the `getHandler` function **directly** (`const getHandler = setupRoutes();`), not `{ getHandler }`. You must match the real helper names already present in `tests/oauth-handlers.test.ts` (`setupRoutes`, `makeReq`, `makeRes`, `mockedExchange`, `mockedGetUserInfo`, `mockedGetUser`, `mockedCreateToken`, `mockedUnrevoke`, `WEB_CALLBACK`). Verify by reading the file before editing.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/oauth-handlers.test.ts`
Expected: FAIL — `expect(received).toHaveBeenCalledWith(1, "dev-1")` fails because oauth.ts still calls `unrevokeDevice(deviceId)` with one arg; the new skip test fails because un-revoke is still attempted.

- [ ] **Step 3: Web callback — capture the synced user and pass its id**

In `server/_core/oauth.ts`, the web callback (`/api/oauth/callback`, lines ~76-92). Replace:

```ts
      await syncUser(userInfo);
      if (deviceId) {
        try {
          await unrevokeDevice(deviceId);
        } catch (error) {
          console.error("[OAuth] Failed to un-revoke device:", error);
        }
      }
```

with:

```ts
      const user = await syncUser(userInfo);
      if (deviceId) {
        const userId = (user as { id?: number | null }).id;
        if (userId != null) {
          try {
            await unrevokeDevice(userId, deviceId);
          } catch (error) {
            console.error("[OAuth] Failed to un-revoke device:", error);
          }
        } else {
          console.warn("[OAuth] Skipping un-revoke: no numeric user id");
        }
      }
```

- [ ] **Step 4: Mobile exchange — capture the synced user and pass its id**

In `server/_core/oauth.ts`, the mobile handler (`/api/oauth/mobile`, lines ~122-138). Replace:

```ts
      const user = await syncUser(userInfo);
      if (deviceId) {
        try {
          await unrevokeDevice(deviceId);
        } catch (error) {
          console.error("[OAuth] Failed to un-revoke device:", error);
        }
      }
```

with:

```ts
      const user = await syncUser(userInfo);
      if (deviceId) {
        const userId = (user as { id?: number | null }).id;
        if (userId != null) {
          try {
            await unrevokeDevice(userId, deviceId);
          } catch (error) {
            console.error("[OAuth] Failed to un-revoke device:", error);
          }
        } else {
          console.warn("[OAuth] Skipping un-revoke: no numeric user id");
        }
      }
```

Note: the mobile handler already declares `const user = await syncUser(userInfo);` — do not double-declare. Verify the existing line and only replace the `if (deviceId)` block.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test tests/oauth-handlers.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Run typecheck + full suite**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0.

Run: `pnpm test`
Expected: full suite green (all memory/DB/cross-user/oauth tests pass).

- [ ] **Step 7: Commit**

```bash
git add server/_core/oauth.ts tests/oauth-handlers.test.ts
git commit -m "feat(auth): un-revoke the synced user's device on login"
```

---

### Task 5: Checkpoint — format, gates, docs, push

**Files:**
- Modify: `todo.md` (Phase 44)

- [ ] **Step 1: Add Phase 44 to `todo.md`**

Append after the Phase 43 section, matching its formatting:

```markdown
## Phase 44: User-Scoped Device Revocation

- [x] revoked_devices gains userId (surrogate id PK + unique index on (userId, deviceId)); legacy rows keep NULL = global legacy block
- [x] isDeviceRevoked(userId, deviceId) matches userId OR NULL; unrevokeDevice(userId, deviceId) clears the caller's row and any global legacy block
- [x] signOutDevice stores the revoking userId; memory backend uses composite keys (${userId}:${deviceId} plus *:${deviceId})
- [x] createContext revocation check passes user.id (claim-authoritative check stays scoped to the user)
- [x] OAuth login un-revokes the synced user's device (skips with a warning when no numeric id resolves)
- [x] Cross-user isolation tests: A's sign-out never blocks B; B's login never clears A's revocation
```

- [ ] **Step 2: Format touched files**

```bash
pnpm exec prettier --write drizzle/schema.ts server/devices.ts server/_core/context.ts server/_core/oauth.ts tests/devices.test.ts tests/device-revoked.test.ts tests/oauth-handlers.test.ts
```

Inspect `git status` — if prettier touched unrelated files, revert those with `git checkout -- <file>` before committing.

- [ ] **Step 3: Run all gates**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0.

Run: `pnpm lint`
Expected: only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning.

Run: `pnpm test`
Expected: all tests pass (memory + DB + oauth + cross-user + NULL-row).

- [ ] **Step 4: Review diff**

Run: `git status` and `git diff --stat`
Expected: schema + migration files (Task 1), `server/devices.ts`, `server/_core/context.ts`, `server/_core/oauth.ts`, three test files, `todo.md`, plus `drizzle/meta/_journal.json`/`0012_snapshot.json`.

- [ ] **Step 5: Commit checkpoint**

```bash
git add todo.md
git commit -m "Checkpoint: v4.4: user-scoped device revocation with legacy global block. TypeScript: 0 errors."
```

- [ ] **Step 6: Push**

Run: `git push origin main`
Expected: pushes to `origin/main`.

---

## Implementation Order & Dependencies

1. **Task 1** — schema + migration (no deps)
2. **Task 2** — devices.ts functions + tests (depends on Task 1's schema types)
3. **Task 3** — context.ts (depends on Task 2's `isDeviceRevoked(userId, deviceId)`)
4. **Task 4** — oauth.ts (depends on Task 2's `unrevokeDevice(userId, deviceId)`)
5. **Task 5** — checkpoint

## Notes for the executor

- Between Tasks 2 and 4, `pnpm check` will show type errors in the not-yet-updated callers (`context.ts`, `oauth.ts`). That is expected mid-plan; the tree must be fully green after Task 4 Step 6.
- The `drizzle.config.ts` throws without `DATABASE_URL` but `drizzle-kit generate` never connects to a DB — a dummy URL is sufficient (Task 1 Step 2).
- `vi.resetAllMocks()` in the oauth-handlers `beforeEach` blocks wipes the `getUserByOpenId` module-factory implementation (verified empirically). Task 4 Step 1 adds an explicit `mockedGetUser.mockResolvedValue({ id: 1, ... })` default after each `resetAllMocks()` call — do not skip this, or the new two-arg assertions will fail.
- The `console.warn` in the no-numeric-id path is intentional: device management is unreachable without a DB, so skipping un-revoke there cannot cause a production lockout (v4.2-style), and the login still completes.
