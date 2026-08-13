# FX + Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all open review follow-ups from v3.16 (Sync Hardening) and v3.17 (Live FX Rates): FX rate-value validation, mobile single-flight, sync setup teardown, sync-now loading state, success tone in Settings, redundant label dedup, and a symmetric pull-guard test.

**Architecture:** Seven small changes across `lib/storage.ts`, `lib/fx.ts`, `lib/sync.ts`, `app/_layout.tsx`, `app/(tabs)/settings.tsx`, and two test files. FX items harden the persisted-rate trust boundary and dedupe concurrent refreshes; sync items fix module-level registry teardown, two Settings UI gaps, a redundant error label, and a missing router test. No new features.

**Tech Stack:** TypeScript 5.9 strict, React Native / Expo, vitest (node env, mocked AsyncStorage + tRPC), Express + tRPC v11.

**Spec:** `docs/superpowers/specs/2026-08-14-fx-sync-hardening-design.md`

---

### Task 1: Storage rate-value validation (`getFxRates`)

**Files:**
- Modify: `lib/storage.ts:361-380` (`getFxRates`)
- Test: `tests/storage.test.ts` (`describe("fx rates")` block)

- [ ] **Step 1: Write the failing tests**

Append two tests to the existing `describe("fx rates")` block at the end of `tests/storage.test.ts`:

```ts
  it("drops non-numeric rate values from a tampered payload", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({
        rates: { EUR: 0.9, GBP: "oops", THB: 34.5 },
        fetchedAt: 5,
      }),
    );
    expect(await getFxRates()).toEqual({ rates: { EUR: 0.9, THB: 34.5 }, fetchedAt: 5 });
  });

  it("returns null when a payload has no valid rate values", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({ rates: { EUR: "oops", GBP: "x" }, fetchedAt: 5 }),
    );
    expect(await getFxRates()).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/storage.test.ts`
Expected: FAIL — the current `getFxRates` returns the raw string values (`GBP: "oops"`) instead of dropping them, and returns `{ rates: { EUR: "oops", GBP: "x" } }` instead of `null` for the all-invalid payload.

- [ ] **Step 3: Implement the fix**

In `lib/storage.ts`, replace the `return { rates: parsed.rates as Record<string, number>, fetchedAt: ... }` statement inside `getFxRates` (lines 373-376) with a value-filtering loop:

```ts
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(
        parsed.rates as Record<string, unknown>,
      )) {
        if (typeof value === "number" && Number.isFinite(value)) {
          rates[code] = value;
        }
      }
      if (Object.keys(rates).length === 0) return null;
      return {
        rates,
        fetchedAt: typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0,
      };
```

The surrounding guard (`if (!parsed || typeof parsed !== "object" || !parsed.rates) return null;`) stays unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/storage.test.ts`
Expected: PASS (all storage tests including the 2 new ones).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/storage.ts tests/storage.test.ts
git commit -m "fix(storage): filter invalid rate values in getFxRates"
```

---

### Task 2: Mobile single-flight (`refreshFxRates`)

**Files:**
- Modify: `lib/fx.ts:35-45` (`refreshFxRates`)
- Test: `tests/fx-client.test.ts` (`describe("fx client")` block)

- [ ] **Step 1: Write the failing test**

Append to the `describe("fx client")` block at the end of `tests/fx-client.test.ts`:

```ts
  it("dedupes concurrent refreshFxRates calls into a single fetch", async () => {
    const query = mockQuery({ rates: { EUR: 0.88 }, fetchedAt: 2000 });
    const [a, b] = await Promise.all([refreshFxRates(), refreshFxRates()]);
    await a;
    await b;
    expect(query).toHaveBeenCalledTimes(1);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(88);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/fx-client.test.ts`
Expected: FAIL — the current `refreshFxRates` makes two separate `fx.get` calls, so `query` is called twice.

- [ ] **Step 3: Implement the fix**

In `lib/fx.ts`, add a module-level guard above `refreshFxRates` and convert `refreshFxRates` from `async function` to a function returning a shared promise:

```ts
let refreshInFlight: Promise<void> | null = null;

export function refreshFxRates(
  storage: Storage = defaultStorage,
): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const result = await fetchFxRates();
      if (!result || result.fetchedAt === null) return;
      await storage.saveFxRates({
        rates: result.rates,
        fetchedAt: result.fetchedAt,
      });
      setExchangeRates(result.rates);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/fx-client.test.ts`
Expected: PASS (all 9 tests — 8 existing + 1 new).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/fx.ts tests/fx-client.test.ts
git commit -m "feat(fx): single-flight refresh in lib/fx.ts"
```

---

### Task 3: Sync label dedup + setup teardown

**Files:**
- Modify: `lib/sync.ts:418-420` (`formatSyncStatus`) and `lib/sync.ts:435-443` (`registerSyncSetup`/`getSyncSetup`)
- Modify: `app/_layout.tsx:189-198` (sync setup effect)
- Test: `tests/sync-status.test.ts`

- [ ] **Step 1: Write the failing tests**

**1a.** In `tests/sync-status.test.ts`, change the import (line 2) from:

```ts
import { formatSyncStatus } from "../lib/sync";
```

to:

```ts
import { formatSyncStatus, getSyncSetup, registerSyncSetup } from "../lib/sync";
```

and add the `SyncSetup` type to the existing type import (line 3):

```ts
import type { SyncMeta, SyncSetup } from "../lib/types";
```

**1b.** Update the failed-sync assertion (line 34). Change:

```ts
    expect(status.label).toBe("Sync failed — Pull failed: network down");
```

to:

```ts
    expect(status.label).toBe("Pull failed: network down");
```

**1c.** Append a new `describe` block at the end of the file:

```ts
describe("registerSyncSetup", () => {
  it("clears the registered setup when the cleanup is invoked", () => {
    const setup = {} as SyncSetup;
    const unregister = registerSyncSetup(setup);
    expect(getSyncSetup()).toBe(setup);
    unregister();
    expect(getSyncSetup()).toBeNull();
  });

  it("does not clear a newer registration", () => {
    const first = {} as SyncSetup;
    const second = {} as SyncSetup;
    const unregisterFirst = registerSyncSetup(first);
    registerSyncSetup(second);
    unregisterFirst();
    expect(getSyncSetup()).toBe(second);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/sync-status.test.ts`
Expected: FAIL — line 34 asserts the old prefixed label; `registerSyncSetup` returns `void` so `unregister` is `undefined` (TypeError).

- [ ] **Step 3: Implement the fixes**

**3a.** In `lib/sync.ts`, change `formatSyncStatus` (lines 418-420) from:

```ts
  if (meta.lastSyncError) {
    return { label: `Sync failed — ${meta.lastSyncError}`, tone: "error" };
  }
```

to:

```ts
  if (meta.lastSyncError) {
    return { label: meta.lastSyncError, tone: "error" };
  }
```

**3b.** In `lib/sync.ts`, change `registerSyncSetup` (lines 437-439) from:

```ts
export function registerSyncSetup(setup: SyncSetup | null): void {
  syncSetupRef = setup;
}
```

to:

```ts
export function registerSyncSetup(setup: SyncSetup | null): () => void {
  syncSetupRef = setup;
  return () => {
    if (syncSetupRef === setup) syncSetupRef = null;
  };
}
```

**3c.** In `app/_layout.tsx`, change the sync setup effect (lines 189-198) from:

```tsx
  useEffect(() => {
    const setup = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
    syncRef.current = setup;
    registerSyncSetup(setup);
  }, [trpcClient]);
```

to:

```tsx
  useEffect(() => {
    const setup = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
    syncRef.current = setup;
    const unregister = registerSyncSetup(setup);
    return () => {
      unregister();
      syncRef.current = null;
    };
  }, [trpcClient]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/sync-status.test.ts`
Expected: PASS (all 9 tests — 7 formatSyncStatus + 2 registerSyncSetup).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/sync.ts app/_layout.tsx tests/sync-status.test.ts
git commit -m "fix(sync): dedup error label; add registerSyncSetup teardown"
```

---

### Task 4: Settings UI — sync-now loading state + success tone

**Files:**
- Modify: `app/(tabs)/settings.tsx` (react-native import lines 3-12, state after line 134, `handleSyncNow` lines 160-167, `descriptionColor` lines 395-398, Sync now button lines 402-420)

No unit tests (React Native component screen; verified via `pnpm check` + `pnpm lint`).

- [ ] **Step 1: Add `ActivityIndicator` to the react-native import**

Change lines 3-12 from:

```tsx
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
  Platform,
} from "react-native";
```

to:

```tsx
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
```

- [ ] **Step 2: Add the `syncing` state**

After line 134 (`const [now, setNow] = useState(() => Date.now());`), add:

```tsx
  const [syncing, setSyncing] = useState(false);
```

- [ ] **Step 3: Wrap `handleSyncNow` in try/finally**

Change lines 160-167 from:

```tsx
  const handleSyncNow = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await getSyncSetup()?.syncNow();
    const meta = await getSyncMeta();
    setSyncMeta(meta);
    setNow(Date.now());
  }, []);
```

to:

```tsx
  const handleSyncNow = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await getSyncSetup()?.syncNow();
      const meta = await getSyncMeta();
      setSyncMeta(meta);
      setNow(Date.now());
    } finally {
      setSyncing(false);
    }
  }, []);
```

- [ ] **Step 4: Map the success tone to a color**

Change `descriptionColor` (lines 395-398) from:

```tsx
            descriptionColor={
              syncStatus.tone === "error" ? colors.error : undefined
            }
```

to:

```tsx
            descriptionColor={
              syncStatus.tone === "error"
                ? colors.error
                : syncStatus.tone === "success"
                  ? colors.success
                  : undefined
            }
```

- [ ] **Step 5: Add the loading state to the Sync now button**

Change the button (lines 402-420) from:

```tsx
                  <TouchableOpacity
                    onPress={handleSyncNow}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: colors.primary + "22",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      Sync now
                    </Text>
                  </TouchableOpacity>
```

to:

```tsx
                  <TouchableOpacity
                    onPress={handleSyncNow}
                    disabled={syncing}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: colors.primary + "22",
                    }}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        Sync now
                      </Text>
                    )}
                  </TouchableOpacity>
```

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm check`
Expected: 0 errors.

Run: `pnpm lint`
Expected: PASS (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/settings.tsx"
git commit -m "feat(settings): sync-now loading state and success tone"
```

---

### Task 5: Symmetric pull-guard router test

**Files:**
- Test: `tests/notifications-router.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the `describe("notifications router")` block in `tests/notifications-router.test.ts`, after the existing "rejects an oversized deviceId for uploadConfig" test (line 152):

```ts
  it("rejects an oversized deviceId for pull", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.pull({ deviceId: "x".repeat(129) }),
    ).rejects.toThrow();
    expect(mockedPull).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test tests/notifications-router.test.ts`
Expected: PASS. (This test should pass immediately — the `.max(128)` guard already exists on `notifications.pull` in `server/routers.ts`. Run it first to confirm the guard is actually enforced and `mockedPull` is untouched.)

- [ ] **Step 3: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add tests/notifications-router.test.ts
git commit -m "test(server): pull rejects oversized deviceId"
```

---

### Task 6: Checkpoint commit + push

**Files:**
- Modify: `todo.md` (append Phase 39)

- [ ] **Step 1: Run all gates**

Run: `pnpm check`
Expected: 0 errors.

Run: `pnpm lint`
Expected: PASS (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

Run: `pnpm test`
Expected: PASS — full suite green. Baseline was 474 tests / 71 files at v3.17; this phase adds 2 (storage) + 1 (fx-client) + 2 (sync-status) + 1 (router) = 6, so expect 480 tests / 71 files.

- [ ] **Step 2: Format**

Run:
```bash
pnpm exec prettier --write lib/storage.ts lib/fx.ts lib/sync.ts app/_layout.tsx "app/(tabs)/settings.tsx" tests/storage.test.ts tests/fx-client.test.ts tests/sync-status.test.ts tests/notifications-router.test.ts
```
Verify no errors. If any file was reformatted, re-run `pnpm check` and `pnpm test` to confirm nothing broke, then include the formatting in the checkpoint commit.

- [ ] **Step 3: Append Phase 39 to `todo.md`**

Append at the end of `todo.md`:

```markdown
## Phase 39: FX + Sync Hardening

- [x] getFxRates filters persisted rates to finite numeric values (NaN guard, static fallback on empty)
- [x] lib/fx.ts refreshFxRates single-flight (launch + Settings no longer race)
- [x] registerSyncSetup returns a teardown that nulls the ref without clobbering newer registrations
- [x] Sync now button loading state (disabled + ActivityIndicator) in Settings
- [x] formatSyncStatus success tone now shown in green in Settings
- [x] formatSyncStatus returns the error string directly (no "Sync failed —" prefix)
- [x] notifications.pull oversized-deviceId router test (symmetric with uploadConfig)
```

- [ ] **Step 4: Review the diff and commit the checkpoint**

Review `git log --oneline -8` and `git diff <task-5-sha> HEAD` for cross-task consistency: the `fetchedAt === null` no-op and single-flight guard in `lib/fx.ts`, the cleanup-only-if-same-setup guard in `lib/sync.ts`, and that all five feature commits are on `main`.

```bash
git add todo.md
git commit -m "Checkpoint: v3.17.1: FX + sync hardening — rate-value validation, fx single-flight, sync setup teardown, sync-now loading state, success tone, label dedup, pull-guard test. TypeScript: 0 errors."
```

- [ ] **Step 5: Push**

```bash
git push
```
