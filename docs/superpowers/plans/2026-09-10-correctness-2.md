# Correctness Bundle 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authenticated logout unregister, audible failures, one shared route table, hygienic reject-timer — no success-path behavior change.

**Architecture:** Await-then-clear ordering; log-on-false; extract-to-`lib/` with per-platform fallbacks; shared finally-clear idiom.

**Tech Stack:** TypeScript + React, vitest root (`pnpm test`) + desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: Authenticated logout unregister

**Files:**
- Modify: `desktop/src/hooks/use-auth.ts` (logout)
- Test: `desktop/tests/use-auth.test.tsx` (extend — read its trpc-mock + session-seed pattern first)

Verified facts (re-confirm): logout is sync `useCallback` with fire-and-forget dynamic-import IIFE; both callers (`Settings.tsx:737` bare call, `:833` onClick) tolerate a promise return; `unregisterServerToken(client): Promise<boolean>` in `desktop/src/lib/push-unregister.ts`; session clear = `removeSessionToken(); clearUserInfo(); notify()`.

- [ ] **Step 1: Write the failing tests** (extend use-auth.test.tsx; read its harness first):

```tsx
it("sends unregister with the session still present", async () => {
  // seed localStorage session token + user (copy existing seed pattern);
  // mock trpc mutate to capture headers/token: the mock client should record
  // getSessionToken() (or the Authorization header) AT CALL TIME;
  // await act(async () => { await logout(); });
  // assert mutate captured a non-null token (proves ordering).
});
it("sets the retry flag and still logs out when unregister fails", async () => {
  // mutate rejects; await logout(); assert user cleared + PENDING_UNREGISTER_KEY === "1".
});
```

How to observe "token present at call time": the existing mock client — check whether it reads `getSessionToken()` lazily (like prod) or returns canned values. If canned, extend the mock to call the REAL `getSessionToken` (import from use-auth? cycle in tests is fine — or read localStorage directly: assert `localStorage` token key still set when mutate invoked by capturing inside mock implementation). Choose whichever the harness supports; key assertion: session data intact during mutate.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test use-auth` (workdir: `desktop/`)
Expected: FAIL — mutate fires after clear (token null) or flag never set.

- [ ] **Step 3: Write minimal implementation**

```tsx
const logout = useCallback(async () => {
  try {
    const { createTRPCClient } = await import("../lib/trpc");
    const ok = await unregisterServerToken(createTRPCClient());
    if (!ok) localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
  } catch {
    localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
  }
  removeSessionToken();
  clearUserInfo();
  notify();
}, []);
```

Keep the dynamic import (cycle comment stays). Callers unchanged (`logout()` / `onClick={logout}` both tolerate promises — verify no caller uses a return value first).

- [ ] **Step 4: Run to verify**

Run: `pnpm test use-auth web-push` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/hooks/use-auth.ts desktop/tests/use-auth.test.tsx
git commit -m "Fix: authenticated logout unregister. TypeScript: 0 errors."
```

---

### Task 2: Audible unregister failures

**Files:**
- Modify: `desktop/src/lib/push-unregister.ts` (log on false)
- Test: `desktop/tests/web-push.test.tsx` (extend — read its unregister section first)

Verified facts (re-confirm): `unregisterServerToken` returns boolean, silent false; callers branch already (disable sets flag, logout sets flag, sync retries).

- [ ] **Step 1: Write the failing test**

```tsx
it("logs the cause when unregister fails", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  mockUnregisterMutate.mockRejectedValue(new Error("offline"));
  await expect(unregisterServerToken(fakeClient())).resolves.toBe(false);
  expect(err).toHaveBeenCalledWith(expect.stringContaining("[push-unregister]"), expect.anything());
  err.mockRestore();
});
```

Also timeout case? The 5s fake-timer variant exists per plan history — mirror it if cheap: never-resolving mutate + advance → false + log. Include both if the harness supports fake timers cleanly.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test web-push` (workdir: `desktop/`)
Expected: FAIL — no console.error.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function unregisterServerToken(client: UnregisterClient): Promise<boolean> {
  try {
    const result = await withTimeout(client.notifications.unregisterPushToken.mutate(), 5000);
    if (result === null) {
      console.error("[push-unregister] timed out after 5000ms");
      return false;
    }
    return true;
  } catch (e) {
    console.error("[push-unregister] unregister failed", e);
    return false;
  }
}
```

- [ ] **Step 4: Run to verify**

Run: `pnpm test web-push` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib/push-unregister.ts desktop/tests/web-push.test.tsx
git commit -m "Fix: log unregister failure causes. TypeScript: 0 errors."
```

---

### Task 3: Shared route mapping

**Files:**
- Create: `lib/notification-routing.ts`
- Modify: `app/_layout.tsx` (adopt with `/(tabs)` fallback)
- Modify: `desktop/src/lib/notification-routing.ts` (adopt with `/` fallback — keep `resolveEventRoute` + listener here; only the 4-arm table moves)
- Test: `tests/notification-routing.test.ts` (new root) + extend `desktop/tests/notification-routing.test.tsx` (fallback pin)

Verified facts (re-confirm): mobile table at `_layout.tsx:127-135` (product/digest/health/else→`/(tabs)`); desktop table (`routeForNotification`) 4 arms with `/` fallback; desktop `resolveEventRoute` calls the table internally (keep that wiring, table import swaps).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/notification-routing.test.ts
import { describe, expect, it } from "vitest";
import { notificationRouteFor } from "../lib/notification-routing";

describe("notificationRouteFor", () => {
  it("maps product/digest/health, null otherwise", () => {
    expect(notificationRouteFor({ productId: "crs804" })).toBe("/product/crs804");
    expect(notificationRouteFor({ type: "digest" })).toBe("/stats");
    expect(notificationRouteFor({ type: "health_blocked" })).toBe("/health");
    expect(notificationRouteFor({})).toBeNull();
    expect(notificationRouteFor({ type: "unknown-thing" })).toBeNull();
  });
});
```

Desktop fallback test (extend notification-routing.test.tsx): `routeForNotification({})` → `"/"` (already covered? read first — if covered, no new test needed there; mobile fallback `/(tabs)` pinned by... mobile has no test harness for _layout (Expo component) — pin via the shared null + a comment? Accept: shared units + desktop fallback test; mobile adoption verified by check + read-through).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/notification-routing.test.ts` (root)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/notification-routing.ts
export function notificationRouteFor(data: { productId?: string; type?: string }): string | null {
  if (data.productId) return `/product/${data.productId}`;
  if (data.type === "digest") return "/stats";
  if (data.type?.startsWith("health")) return "/health";
  return null;
}
```

Mobile `_layout`: `... ?? "/(tabs)"` (replace inline if/else with `notificationRouteFor(data) ?? "/(tabs)"` — verify surrounding code shape first). Desktop `routeForNotification`: `return notificationRouteFor(data) ?? "/";` (keep its export + signature; `resolveEventRoute` untouched).

- [ ] **Step 4: Run to verify**

Run: `pnpm vitest run tests/notification-routing.test.ts` (root); `pnpm test notification-routing` (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0 — proves `lib/` import clean... desktop already imports lib widely; still run).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notification-routing.ts tests/notification-routing.test.ts app/_layout.tsx desktop/src/lib/notification-routing.ts desktop/tests/notification-routing.test.tsx (last ONLY if changed — verify via git status)
git commit -m "Refactor: shared notification route mapping. TypeScript: 0 errors."
```

---

### Task 4: Reject-timer hygiene

**Files:**
- Modify: `components/search/manual-add-sheet.tsx` (finally-clear)
- Test: extend the manual-add suite? (No suite exists per sync-Task-1 report — "Manual-add suite: none exists". So: root string-guard? Better: tiny behavioral test is impractical without a harness (Expo component). Decision: mirror the shared helper's leak test as a root test importing a pure extraction? The function is module-local... Options: (a) export `withTimeoutReject` for testability + root unit test with getTimerCount; (b) string-guard asserting clearTimeout present. Choose (a): export it (name already distinct), add `tests/manual-add-timeout.test.ts` importing from the component file? Importing a .tsx component into root vitest pulls RN deps — DANGER (RN import chain). Safer: (b) string-guard `tests/manual-add-timeout-guard.test.ts` asserting `withTimeoutReject` body contains `clearTimeout` + `.finally`. Go with (b).)

- [ ] **Step 1: Write the failing guard**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("manual-add timeout hygiene", () => {
  it("clears its timer on settle", async () => {
    const text = await readFile("components/search/manual-add-sheet.tsx", "utf8");
    expect(text).toContain("clearTimeout");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/manual-add-timeout-guard.test.ts` (root)
Expected: FAIL — no clearTimeout in the file.

- [ ] **Step 3: Write minimal implementation**

```ts
function withTimeoutReject<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
```

Reject semantics preserved (finally passes through).

- [ ] **Step 4: Run to verify**

Run: guard (root); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/search/manual-add-sheet.tsx tests/manual-add-timeout-guard.test.ts
git commit -m "Fix: clear manual-add discovery timer. TypeScript: 0 errors."
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
