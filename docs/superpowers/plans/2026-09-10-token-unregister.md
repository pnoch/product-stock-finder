# Token Unregister Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push tokens die with opt-out and sign-out via a new unregister endpoint plus desktop calls — no more stale targeting.

**Architecture:** Thin protected mutation over existing `pruneDeviceToken`; desktop best-effort calls (disable after local unsubscribe, logout before session clear). No input validation surface (no input).

**Tech Stack:** tRPC v11, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: `unregisterPushToken` endpoint

**Files:**
- Modify: `server/routers.ts` (after `registerPushToken`, ~348)
- Test: `tests/push-unregister.test.ts` (new)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): register block shape (`protectedProcedure`, deviceId guard → BAD_REQUEST, `assertDeviceAccess`, `{accepted: true}`); `pruneDeviceToken(deviceId)` imported? (routers.ts imports `upsertPushToken` from `./push-notifications` — add `pruneDeviceToken` to that import); memory fallback when `getDb()` null (`memoryTokens` map); router-test harness = `vi.mock("../server/db", getDb→null)` + authed context with deviceId (copy from `tests/notifications-router.test.ts` — read its `createAuthedContext` fully first).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/db", () => ({ getDb: vi.fn(async () => null) }));
vi.mock("../server/devices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/devices")>();
  return { ...actual, assertDeviceAccess: vi.fn(async () => {}) };
});

import { upsertPushToken, listMemoryTokenDevices, clearPushTokensForTests } from "../server/push-notifications";
import { assertDeviceAccess } from "../server/devices";

function authed(userId: number, deviceId: string | null): TrpcContext {
  return { user: { id: userId, openId: `open-${userId}`, ... }, req: {...}, res: {...}, deviceId } as TrpcContext;
}
```

Copy the user/req/res shapes EXACTLY from notifications-router.test.ts (do not improvise). Cases:
1. register → unregister → gone: `upsertPushToken("dev-1", "tok", "web", 7)` (real), assert `listMemoryTokenDevices()` contains dev-1; `caller.unregisterPushToken()` → list no longer contains dev-1; returns `{accepted: true}`.
2. idempotent empty: fresh device, unregister → `{accepted: true}`, no throw.
3. missing deviceId (null) → rejects BAD_REQUEST.
4. `assertDeviceAccess` called with `(userId, deviceId)` (verifies ownership guard wiring).

`beforeEach`: `clearPushTokensForTests()` (verify export exists — push-notifications.ts:169 confirmed).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/push-unregister.test.ts` (root)
Expected: FAIL — `caller.notifications.unregisterPushToken` is not a function (read the actual error; must be missing-procedure, not harness breakage — if harness breaks, fix the harness first).

- [ ] **Step 3: Write minimal implementation** (after registerPushToken block):

```ts
unregisterPushToken: protectedProcedure.mutation(async ({ ctx }) => {
  if (!ctx.deviceId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Missing device id",
    });
  }
  await assertDeviceAccess(ctx.user.id, ctx.deviceId);
  await pruneDeviceToken(ctx.deviceId);
  return { accepted: true } as const;
}),
```

Add `pruneDeviceToken` to the `./push-notifications` import (verify `TRPCError`/`assertDeviceAccess` already imported — they are, per register block).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/push-unregister.test.ts tests/notifications-router.test.ts tests/push-token.test.ts` (root)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts tests/push-unregister.test.ts
git commit -m "Feat: push token unregister endpoint. TypeScript: 0 errors."
```

---

### Task 2: Desktop disable + logout calls

**Files:**
- Modify: `desktop/src/lib/web-push.ts` (`disablePush`)
- Modify: `desktop/src/hooks/use-auth.ts` (`logout`)
- Test: `desktop/tests/web-push.test.tsx` (extend) + `desktop/tests/use-auth.test.tsx`? (check existing use-auth test file name first — `desktop/tests/use-auth.test.tsx` exists? verify; logout test goes there or in web-push suite — prefer the use-auth suite if it exists)

Verified facts (re-confirm): `disablePush` unsubscribes locally, never throws; desktop tRPC mock form `{notifications: {registerPushToken: {mutate}}}` (extend with `unregisterPushToken: {mutate}`); `logout` is sync (`removeSessionToken(); clearUserInfo(); notify()`) — the unregister call must be fire-and-forget (`void ... .catch(()=>{})`? mutate returns promise; `void client...mutate().catch(() => {})` — hmm, actually just `void` without catch → unhandled rejection on failure! Use `.catch(() => {})` explicitly... `void` + `.catch`: `void mutate().catch(() => {})` handles it. Write it that way.)

- [ ] **Step 1: Write the failing tests**

web-push.test.tsx (append; read current mocks first):
```tsx
it("unregisters the server token on disable", async () => {
  // render nothing — call disablePush() with a subscribed sub;
  // expect unregisterMutate toHaveBeenCalledWith(undefined or {}) — no input!
});
```

Endpoint takes NO input: `client.notifications.unregisterPushToken.mutate()` — assert called with `undefined`. Check how the desktop tRPC mock is shaped (mutate: mockMutate) and assert accordingly.

use-auth suite:
```tsx
it("unregisters push on logout without blocking", async () => {
  // mock trpc unregister to REJECT; call logout(); assert logout completes (user null) and mutate was attempted.
});
```

Read the existing use-auth test harness first (how it renders the hook — `renderHook`? — and mocks trpc/storage). If no harness exists, create minimal: mock `../src/lib/trpc`, mock storage fns, `renderHook(() => useAuth())`, set a session first? (login flow heavy — alternative: seed localStorage token + user, render, `act(logout)`, assert cleared + mutate called). Keep it minimal but real.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test web-push use-auth` (workdir: `desktop/`)
Expected: FAIL — `unregisterPushToken` undefined on the mocked client (extend mocks to include it returning a mock fn, then the CALL assertion fails).

- [ ] **Step 3: Write minimal implementation**

```ts
// web-push.ts disablePush — after successful local unsubscribe (or regardless? DECISION: call unregister whenever disable is invoked and supported, even if no local subscription existed — server token may exist from another browser profile. Place AFTER the try/catch, outside it? If local unsubscribe throws, we still want server prune. Structure:
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  try { ...local unsubscribe... } catch { ... }
  try {
    const client = createTRPCClient();
    await client.notifications.unregisterPushToken.mutate();
  } catch {
    // best-effort: dead endpoints prune on send failure
  }
}
```

Hmm — but signed-out disablePush → 401 → caught → fine. And Task 3's toggle calls disablePush — covered automatically. Verify the toggle tests still pass (they mock the module — `vi.mock("../src/lib/web-push")` with explicit export list? If settings-push mocks with a factory lacking... it mocks the module — check whether the factory enumerates exports (if so, no change needed since disablePush name unchanged).

```ts
// use-auth.ts logout:
const logout = useCallback(() => {
  try {
    const client = createTRPCClient();
    void client.notifications.unregisterPushToken.mutate().catch(() => {});
  } catch { /* sync client construction failure — ignore */ }
  removeSessionToken();
  clearUserInfo();
  notify();
}, []);
```

Verify `createTRPCClient` import exists in use-auth (it uses trpc hooks? check imports first — if not imported, add `import { createTRPCClient } from "../lib/trpc"` with correct depth).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test web-push settings-push use-auth` (workdir: `desktop/`); `pnpm check` (root, 0 errors); `pnpm build` (workdir: `desktop/`, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib/web-push.ts desktop/src/hooks/use-auth.ts desktop/tests/web-push.test.tsx <use-auth test file> (verify via git status)
git commit -m "Feat: unregister push token on disable and logout. TypeScript: 0 errors."
```

---

### Final verification (all tasks)

```bash
pnpm check          # expect: 0 errors
pnpm lint           # expect: 0 errors
pnpm test           # expect: 0 failures (root)
pnpm test           # workdir desktop/ — expect: 0 failures
pnpm build          # workdir desktop/ — expect: exit 0
```

Do NOT push. Report DONE (per-task outcome + verification counts) or BLOCKED/NEEDS_CONTEXT.
