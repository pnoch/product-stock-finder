# Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing account-based cross-device sync: add server input guards, pin engine guarantees with tests, persist sync status for error surfacing, and add a "Sync now" button in Settings.

**Architecture:** Add `.max(128)` deviceId guards to the notifications router and regression tests at the router boundary; extend `SyncMeta` with `lastSyncError`/`lastSyncOkAt` written by `doSync`; add a pure `formatSyncStatus` helper + a module-level sync-setup handle; wire a "Sync now" button and error tone into the Settings screen. Mobile and desktop share `lib/sync.ts`, so engine changes cover both.

**Tech Stack:** TypeScript 5.9 strict, tRPC v11 + zod, vitest (node env), React Native / Expo, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-08-13-sync-hardening-design.md`

**Note on existing coverage:** `tests/sync-engine.test.ts` already covers single-flight (line 317), tombstone propagation (line 407), and push-failure cursor behavior (line 297). Do NOT re-add those; this plan adds the missing tests and the status assertions.

---

### Task 1: Server deviceId guards + router-boundary regression tests

**Files:**
- Modify: `server/routers.ts` (uploadConfig input ~line 128, pull input ~line 165)
- Test: `tests/notifications-router.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/notifications-router.test.ts` inside the `describe("notifications router", ...)` block (after the existing tests, before the closing `});`):

```ts
  it("forwards stock watch lastKnownStatus through uploadConfig", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    await caller.notifications.uploadConfig({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [
        {
          id: "w1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "d1",
          lastKnownStatus: "back_order",
        },
      ],
      dateReminders: [],
    });
    expect(mockedUpsert).toHaveBeenCalledWith("dev-1", {
      alerts: [],
      stockWatches: [
        {
          id: "w1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "d1",
          lastKnownStatus: "back_order",
        },
      ],
      dateReminders: [],
    });
  });

  it("rejects an oversized deviceId for uploadConfig", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.uploadConfig({
        deviceId: "x".repeat(129),
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      }),
    ).rejects.toThrow();
    expect(mockedUpsert).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to see which fail**

Run: `pnpm test tests/notifications-router.test.ts`
Expected: the `lastKnownStatus` test PASSES immediately (it pins the existing Phase 32 behavior). The oversized-deviceId test FAILS (a 129-char id currently passes validation, so `rejects.toThrow()` is not satisfied).

- [ ] **Step 3: Add the `.max(128)` guards**

In `server/routers.ts`, change the `uploadConfig` deviceId schema (line ~128) from:

```ts
          deviceId: z.string().min(1),
```

to:

```ts
          deviceId: z.string().min(1).max(128),
```

Change the `pull` deviceId schema (line ~165) from:

```ts
      .input(z.object({ deviceId: z.string().min(1) }))
```

to:

```ts
      .input(z.object({ deviceId: z.string().min(1).max(128) }))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/notifications-router.test.ts`
Expected: PASS (all tests in the file, including the 2 new ones).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add server/routers.ts tests/notifications-router.test.ts
git commit -m "feat(server): guard notification deviceId length and pin lastKnownStatus boundary"
```

---

### Task 2: Sync status persistence + engine tests

**Files:**
- Modify: `lib/types.ts` (SyncMeta, line 130)
- Modify: `lib/sync.ts` (`doSync`, lines 45-101)
- Test: `tests/sync-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/sync-engine.test.ts`, inside the `describe("syncNow", ...)` block, make these changes.

**1a. Extend the existing success test** (the test starting at line 270, "pushes dirty local items with stripped priceHistory and advances lastSyncedAt"). After the existing `expect(meta.lastSyncedAt).toBe(3000);` add:

```ts
    expect(meta.lastSyncError).toBeNull();
    expect(meta.lastSyncOkAt).toBe(3000);
```

**1b. Extend the existing push-failure test** (line 297, "keeps lastSyncedAt unchanged when push fails"). After the existing `expect(meta.lastSyncedAt).toBe(0);` add:

```ts
    expect(meta.lastSyncError).toContain("Push failed");
```

**1c. Add a pull-failure test.** Append after the push-failure test:

```ts
  it("keeps lastSyncedAt unchanged and records an error when pull fails", async () => {
    const storage = makeStorage();
    const pull = vi.fn(async () => {
      throw new Error("network down");
    });
    const push = vi.fn();
    await expect(
      syncNow({
        storage,
        isSignedIn: () => true,
        pull,
        push,
        now: () => 3000,
      }),
    ).resolves.toBeUndefined();
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBe(0);
    expect(meta.lastSyncError).toContain("Pull failed");
    expect(push).not.toHaveBeenCalled();
  });
```

**1d. Add a resurrection test.** Append:

```ts
  it("pushes a re-added item as a live update, not a tombstone", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1000);
    await storage.removeFromWatchlist("p1");
    await storage.markItemDeleted("watchlist", "p1", 2000);
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 1500, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 1 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    expect(push).toHaveBeenCalledTimes(1);
    const pushed = push.mock.calls[0]![0];
    expect(pushed).toHaveLength(1);
    expect(pushed[0]!.collection).toBe("watchlist");
    expect(pushed[0]!.id).toBe("p1");
    expect(pushed[0]!.deletedAt).toBeNull();
    expect(pushed[0]!.data).toBeTruthy();
  });
```

**1e. Add an LWW-tie test.** Append:

```ts
  it("keeps local when pulled updatedAt equals local meta updatedAt", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(
      makeProduct("p1", [listing("d1", 100, "in_stock")]),
    );
    await storage.setItemSyncMeta("watchlist", "p1", 4000);
    const serverProduct = makeProduct("p1", [listing("d1", 90, "in_stock")]);
    const pull = vi.fn(async (): Promise<{ lastSyncedAt: number; items: SyncItem[] }> => ({
      lastSyncedAt: 5000,
      items: [
        {
          collection: "watchlist",
          id: "p1",
          data: serverProduct,
          updatedAt: 4000,
          deletedAt: null,
        },
      ],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({ accepted: 0 }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });
    expect((await storage.getWatchlist())[0]!.listings[0]!.price).toBe(100);
  });
```

- [ ] **Step 2: Run tests to verify the status ones fail**

Run: `pnpm test tests/sync-engine.test.ts`
Expected: the two extended tests + the pull-failure test FAIL (no `lastSyncError`/`lastSyncOkAt` on `SyncMeta` yet, and the impl doesn't write them). The resurrection + LWW-tie tests PASS immediately (they pin existing engine behavior).

- [ ] **Step 3: Extend `SyncMeta` and update `doSync`**

In `lib/types.ts`, change the `SyncMeta` interface (line 130) from:

```ts
export interface SyncMeta {
  lastSyncedAt: number;
  items: Record<string, Record<string, { updatedAt: number; deleted: boolean }>>;
}
```

to:

```ts
export interface SyncMeta {
  lastSyncedAt: number;
  lastSyncOkAt?: number;
  lastSyncError?: string | null;
  items: Record<string, Record<string, { updatedAt: number; deleted: boolean }>>;
}
```

In `lib/sync.ts`, make three edits:

**3a. Pull-failure path** (lines 46-51). Change:

```ts
  let pulled: { lastSyncedAt: number; items: SyncItem[] };
  try {
    pulled = await opts.pull(since);
  } catch (error) {
    console.warn("[Sync] Pull failed; skipping sync", error);
    return;
  }
```

to:

```ts
  let pulled: { lastSyncedAt: number; items: SyncItem[] };
  try {
    pulled = await opts.pull(since);
  } catch (error) {
    console.warn("[Sync] Pull failed; skipping sync", error);
    await storage.saveSyncMeta({
      ...(await storage.getSyncMeta()),
      lastSyncError: `Pull failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return;
  }
```

**3b. Push-failure path** (lines 77-83). Change:

```ts
    try {
      await opts.push(dirty);
    } catch (error) {
      console.warn("[Sync] Push failed; local changes kept", error);
      return;
    }
```

to:

```ts
    try {
      await opts.push(dirty);
    } catch (error) {
      console.warn("[Sync] Push failed; local changes kept", error);
      await storage.saveSyncMeta({
        ...(await storage.getSyncMeta()),
        lastSyncError: `Push failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return;
    }
```

**3c. Success path** (lines 96-101). Change:

```ts
  const nextCursor = Math.max(pulled.lastSyncedAt, nowValue);
  await storage.saveSyncMeta({
    ...(await storage.getSyncMeta()),
    lastSyncedAt: nextCursor,
  });
```

to:

```ts
  const nextCursor = Math.max(pulled.lastSyncedAt, nowValue);
  await storage.saveSyncMeta({
    ...(await storage.getSyncMeta()),
    lastSyncedAt: nextCursor,
    lastSyncError: null,
    lastSyncOkAt: nowValue,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/sync-engine.test.ts`
Expected: PASS (all tests, including the extended success/push-failure tests and the pull-failure, resurrection, LWW-tie tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/types.ts lib/sync.ts tests/sync-engine.test.ts
git commit -m "feat(sync): persist last sync status for error surfacing"
```

---

### Task 3: `formatSyncStatus` helper + unit tests

**Files:**
- Modify: `lib/sync.ts`
- Create: `tests/sync-status.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/sync-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatSyncStatus } from "../lib/sync";
import type { SyncMeta } from "../lib/types";

function makeMeta(overrides: Partial<SyncMeta> = {}): SyncMeta {
  return { lastSyncedAt: 0, items: {}, ...overrides };
}

describe("formatSyncStatus", () => {
  it("prompts sign-in when signed out", () => {
    expect(formatSyncStatus(makeMeta(), false, Date.now())).toEqual({
      label: "Sign in to sync across devices",
      tone: "muted",
    });
  });

  it("prompts sign-in even when a prior error exists", () => {
    expect(
      formatSyncStatus(makeMeta({ lastSyncError: "Pull failed: x" }), false, Date.now()),
    ).toEqual({ label: "Sign in to sync across devices", tone: "muted" });
  });

  it("reports a failed sync in error tone", () => {
    const status = formatSyncStatus(
      makeMeta({ lastSyncError: "Pull failed: network down" }),
      true,
      Date.now(),
    );
    expect(status.tone).toBe("error");
    expect(status.label).toBe("Sync failed — Pull failed: network down");
  });

  it("reports not synced yet when signed in with no success timestamp", () => {
    expect(formatSyncStatus(makeMeta(), true, Date.now())).toEqual({
      label: "Not synced yet",
      tone: "muted",
    });
  });

  it("shows a recent sync in success tone", () => {
    const now = 1_000_000;
    const status = formatSyncStatus(
      makeMeta({ lastSyncedAt: now - 10_000 }),
      true,
      now,
    );
    expect(status.label).toBe("Synced just now");
    expect(status.tone).toBe("success");
  });

  it("uses lastSyncOkAt as the success timestamp when present", () => {
    const now = 1_000_000;
    const status = formatSyncStatus(
      makeMeta({ lastSyncedAt: now - 10_000_000, lastSyncOkAt: now - 600_000 }),
      true,
      now,
    );
    expect(status.label).toBe("Last synced 10m ago");
  });

  it("falls back to muted tone for stale syncs", () => {
    const now = 1_000_000;
    const status = formatSyncStatus(
      makeMeta({ lastSyncedAt: now - 600_000 }),
      true,
      now,
    );
    expect(status.label).toBe("Last synced 10m ago");
    expect(status.tone).toBe("muted");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/sync-status.test.ts`
Expected: FAIL — `formatSyncStatus` is not exported from `../lib/sync`.

- [ ] **Step 3: Implement `formatSyncStatus`**

In `lib/sync.ts`:

Add `SyncMeta` to the type import (lines 2-9):

```ts
import type {
  AppSettings,
  BackOrderReminder,
  Collection,
  PriceAlert,
  Product,
  SyncItem,
  SyncMeta,
} from "./types";
```

Add these exports at the end of the file (after `setupSync`):

```ts
export interface SyncStatus {
  label: string;
  tone: "success" | "error" | "muted";
}

export function formatSyncStatus(
  meta: SyncMeta,
  isAuthenticated: boolean,
  now: number,
): SyncStatus {
  if (!isAuthenticated) {
    return { label: "Sign in to sync across devices", tone: "muted" };
  }
  if (meta.lastSyncError) {
    return { label: `Sync failed — ${meta.lastSyncError}`, tone: "error" };
  }
  const successAt = meta.lastSyncOkAt ?? meta.lastSyncedAt;
  if (!successAt) {
    return { label: "Not synced yet", tone: "muted" };
  }
  const minutes = Math.floor((now - successAt) / 60000);
  const label =
    minutes < 1
      ? "Synced just now"
      : minutes < 60
        ? `Last synced ${minutes}m ago`
        : `Last synced ${Math.floor(minutes / 60)}h ago`;
  return { label, tone: minutes < 5 ? "success" : "muted" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/sync-status.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/sync.ts tests/sync-status.test.ts
git commit -m "feat(sync): add formatSyncStatus helper"
```

---

### Task 4: Sync-setup handle + Settings UI

**Files:**
- Modify: `lib/sync.ts` (add `registerSyncSetup`/`getSyncSetup`)
- Modify: `app/_layout.tsx` (register the setup)
- Modify: `app/(tabs)/settings.tsx`

There is no component-test infrastructure (vitest runs in a node env); verify via `pnpm check` + `pnpm lint`.

- [ ] **Step 1: Add the module-level sync handle to `lib/sync.ts`**

Append after `setupSync` (end of file, after the `formatSyncStatus` export added in Task 3):

```ts
let syncSetupRef: SyncSetup | null = null;

export function registerSyncSetup(setup: SyncSetup | null): void {
  syncSetupRef = setup;
}

export function getSyncSetup(): SyncSetup | null {
  return syncSetupRef;
}
```

- [ ] **Step 2: Register the setup in `app/_layout.tsx`**

The file already imports `setupSync, type SyncSetup` from `@/lib/sync` (line 44). Add `registerSyncSetup` to that import:

```ts
import { setupSync, registerSyncSetup, type SyncSetup } from "@/lib/sync";
```

Change the setup effect (lines 188-195) from:

```tsx
  useEffect(() => {
    syncRef.current = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
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
    registerSyncSetup(setup);
  }, [trpcClient]);
```

- [ ] **Step 3: Update `app/(tabs)/settings.tsx`**

**3a. Imports.** Add a `@/lib/sync` import after the `@/lib/storage` import (line 25):

```ts
import { formatSyncStatus, getSyncSetup } from "@/lib/sync";
```

Add `SyncMeta` to the `@/lib/types` import (line 26):

```ts
import { AppSettings, Product, DistributorListing, SyncMeta } from "@/lib/types";
```

**3b. Add `descriptionColor` to `SettingRow`** (lines 32-83). Change the props type:

```ts
function SettingRow({
  icon,
  label,
  description,
  descriptionColor,
  right,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  description?: string;
  descriptionColor?: string;
  right: React.ReactNode;
}) {
```

Change the description `Text` (lines 74-78) from:

```tsx
        {description && (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
            {description}
          </Text>
        )}
```

to:

```tsx
        {description && (
          <Text
            style={{
              color: descriptionColor ?? colors.muted,
              fontSize: 12,
              marginTop: 1,
            }}
          >
            {description}
          </Text>
        )}
```

**3c. Replace the sync status state.** Change line 118:

```ts
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
```

to:

```ts
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
```

**3d. Update the polling effect** (lines 121-137). Change `setLastSyncedAt(meta.lastSyncedAt || null);` to `setSyncMeta(meta);`:

```ts
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = async () => {
      const meta = await getSyncMeta();
      if (!cancelled) {
        setSyncMeta(meta);
        setNow(Date.now());
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);
```

**3e. Replace the `syncStatusLabel` IIFE** (lines 139-146) with a status object plus a "Sync now" handler:

```ts
  const syncStatus = syncMeta
    ? formatSyncStatus(syncMeta, isAuthenticated, now)
    : isAuthenticated
      ? { label: "Not synced yet", tone: "muted" as const }
      : { label: "Sign in to sync across devices", tone: "muted" as const };

  const handleSyncNow = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await getSyncSetup()?.syncNow();
    const meta = await getSyncMeta();
    setSyncMeta(meta);
    setNow(Date.now());
  }, []);
```

**3f. Update the Sync status `SettingRow`** (lines 366-389). Change it from:

```tsx
          <SettingRow
            icon="arrow.triangle.2.circlepath"
            label="Sync status"
            description={syncStatusLabel}
            right={
              isAuthenticated ? (
                <TouchableOpacity
                  onPress={logout}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.error + "22",
                  }}
                >
                  <Text
                    style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}
                  >
                    Sign out
                  </Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
```

to:

```tsx
          <SettingRow
            icon="arrow.triangle.2.circlepath"
            label="Sync status"
            description={syncStatus.label}
            descriptionColor={
              syncStatus.tone === "error" ? colors.error : undefined
            }
            right={
              isAuthenticated ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
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
                      style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
                    >
                      Sync now
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={logout}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: colors.error + "22",
                    }}
                  >
                    <Text
                      style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}
                    >
                      Sign out
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : undefined
            }
          />
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all sync/status/router tests from Tasks 1-3 still green.

- [ ] **Step 7: Format and commit**

Run: `pnpm exec prettier --write "app/(tabs)/settings.tsx" app/_layout.tsx lib/sync.ts`
Expected: formatting applied (no errors).

```bash
git add lib/sync.ts app/_layout.tsx "app/(tabs)/settings.tsx"
git commit -m "feat(settings): sync status error surface and sync now button"
```

---

### Task 5: Checkpoint commit

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Add the Phase 37 section to `todo.md`**

Append at the end of `todo.md`:

```markdown
## Phase 37: Sync Hardening

- [x] notifications.uploadConfig / pull deviceId length guard (.max(128))
- [x] Router-boundary regression test for stock watch lastKnownStatus passthrough
- [x] Sync-engine tests: pull failure, resurrection, LWW tie, status writes on all paths
- [x] Persisted sync status (SyncMeta.lastSyncError / lastSyncOkAt) written by doSync
- [x] formatSyncStatus helper + unit tests
- [x] Settings sync-status error tone + "Sync now" button
```

- [ ] **Step 2: Verify all gates**

Run: `pnpm check`, `pnpm lint`, `pnpm test`
Expected: 0 TS errors, lint clean (pre-existing warning only), all tests pass.

- [ ] **Step 3: Final review and checkpoint commit**

Review the full diff (`git diff HEAD~7`) for consistency: `SyncMeta` fields (`lastSyncError`, `lastSyncOkAt`), `formatSyncStatus` return shape (`label`/`tone`), and the handle functions (`registerSyncSetup`/`getSyncSetup`) match everywhere (lib/sync.ts, settings.tsx, tests).

```bash
git add todo.md
git commit -m "Checkpoint: v3.16: Sync hardening — deviceId guards, router-boundary regression tests, sync-status persistence, error surface and sync-now in Settings. TypeScript: 0 errors."
```

- [ ] **Step 4: Push**

```bash
git push
```
