# Watch Anywhere + New-Source Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user watch a product across every distributor (including a newly discovered one), firing one restock notification naming the store(s).

**Architecture:** `BackOrderReminder` gains `scope` + `lastKnownStatusByDistributor`; `runCheckRestocks` gains an `"any"` branch scanning all listings; the server `buildEvents` mirrors it; `scope` flows through `uploadConfig`; the product-detail action gains a scope choice.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-watch-anywhere-design.md`

---

## File Structure

- Modify `lib/types.ts` — `scope` + `lastKnownStatusByDistributor`.
- Modify `lib/storage/reminders.ts` — `updateStockWatchStatuses`.
- Modify `lib/restock.ts` — the `"any"` branch.
- Modify `app/product/[id].tsx` — scope choice at creation.
- Modify `lib/server-notifications.ts` + `desktop/src/server-notifications.ts` — upload `scope`.
- Modify `server/routers/notifications.ts` — accept `scope`.
- Modify `server/notifications/types.ts` + `build-events.ts` — evaluate `"any"`.
- Modify `app/restock-watches.tsx` — render "Any distributor".
- Tests: `tests/restock-any-scope.test.ts`, `tests/server-restock-any.test.ts`, extend `tests/reminders-storage.test.ts`.

---

### Task 1: Data model + storage helper

**Files:** Modify `lib/types.ts`, `lib/storage/reminders.ts`; Test `tests/reminders-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/reminders-storage.test.ts`:

```ts
import { updateStockWatchStatuses, addStockWatch, getStockWatches } from "../lib/storage/reminders";

describe("any-scope stock watches", () => {
  it("de-dupes an 'any' watch on the '*' sentinel", async () => {
    await addStockWatch({
      id: "w1", productId: "p1", productName: "P", distributorId: "*",
      distributorName: "Any distributor", reminderDate: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z", reminderType: "back_in_stock", scope: "any",
    });
    await addStockWatch({
      id: "w2", productId: "p1", productName: "P", distributorId: "*",
      distributorName: "Any distributor", reminderDate: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-02T00:00:00.000Z", reminderType: "back_in_stock", scope: "any",
    });
    const watches = await getStockWatches();
    expect(watches.filter((w) => w.productId === "p1")).toHaveLength(1);
  });

  it("updateStockWatchStatuses sets the per-distributor map", async () => {
    await addStockWatch({
      id: "w3", productId: "p2", productName: "P2", distributorId: "*",
      distributorName: "Any distributor", reminderDate: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z", reminderType: "back_in_stock", scope: "any",
    });
    await updateStockWatchStatuses("w3", { d1: "in_stock", d2: "back_order" });
    const watch = (await getStockWatches()).find((w) => w.id === "w3");
    expect(watch?.lastKnownStatusByDistributor).toEqual({ d1: "in_stock", d2: "back_order" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/reminders-storage.test.ts`
Expected: FAIL — `updateStockWatchStatuses` not exported.

- [ ] **Step 3: Implement**

In `lib/types.ts`, add to `BackOrderReminder`:

```ts
  /** "distributor" (default, legacy) watches one store; "any" watches all. */
  scope?: "distributor" | "any";
  /** Per-distributor last-known status, for "any" watches. */
  lastKnownStatusByDistributor?: Record<string, string>;
```

In `lib/storage/reminders.ts`, add (near `updateStockWatchStatus`) and export it in the returned object:

```ts
  async function updateStockWatchStatuses(
    watchId: string,
    statuses: Record<string, string>,
  ): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      const updated = watches.map((w) =>
        w.id === watchId ? { ...w, lastKnownStatusByDistributor: statuses } : w,
      );
      await persistStockWatches(updated);
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/reminders-storage.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage/reminders.ts tests/reminders-storage.test.ts
git commit -m "feat(restock): any-scope watch model + statuses helper"
```

---

### Task 2: Client detection — `"any"` branch

**Files:** Modify `lib/restock.ts`; Test `tests/restock-any-scope.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/restock-any-scope.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { checkRestocks } from "../lib/restock";

function storage(watches: unknown[], listings: unknown[]) {
  return {
    getStockWatches: vi.fn(async () => watches),
    getWatchlist: vi.fn(async () => [{ id: "p1", name: "CRS804", listings }]),
    getSettings: vi.fn(async () => ({ notificationsEnabled: true, stockAlerts: true })),
    removeStockWatch: vi.fn(async () => {}),
    updateStockWatchStatus: vi.fn(async () => {}),
    updateStockWatchStatuses: vi.fn(async () => {}),
    recordNotificationEvent: vi.fn(async () => {}),
  } as never;
}

const anyWatch = {
  id: "w1", productId: "p1", productName: "CRS804", distributorId: "*",
  distributorName: "Any distributor", reminderDate: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z", reminderType: "back_in_stock", scope: "any",
  lastKnownStatusByDistributor: { d1: "back_order" },
};

describe("checkRestocks — any scope", () => {
  it("fires when a different distributor goes in stock", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d1", stockStatus: "back_order", price: 1, currency: "USD" },
      { distributorId: "d2", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const notify = vi.fn(async () => true);
    await checkRestocks(s, notify);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][1]).toContain("d2");
  });

  it("fires on a NEW distributor id (new source)", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d9", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const notify = vi.fn(async () => true);
    await checkRestocks(s, notify);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("does not fire when nothing transitions", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d1", stockStatus: "back_order", price: 1, currency: "USD" },
    ]);
    const notify = vi.fn(async () => true);
    await checkRestocks(s, notify);
    expect(notify).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/restock-any-scope.test.ts`
Expected: FAIL — the `"any"` branch does not exist.

- [ ] **Step 3: Implement**

In `lib/restock.ts` `runCheckRestocks`, branch on `watch.scope`. Replace the per-watch body with:

```ts
  for (const watch of watches) {
    const product = watchlist.find((p) => p.id === watch.productId);
    if (!product?.listings?.length) continue;

    if (watch.scope === "any") {
      const prev = watch.lastKnownStatusByDistributor ?? {};
      const inStockNow = product.listings.filter(
        (l) => l.stockStatus === "in_stock",
      );
      const newlyInStock = inStockNow.filter(
        (l) => (prev[l.distributorId] ?? "back_order") !== "in_stock",
      );
      // Persist the current statuses for the next cycle regardless of notify
      // outcome only AFTER a successful notify, so a failed send re-detects.
      if (newlyInStock.length === 0) {
        await storage.updateStockWatchStatuses(
          watch.id,
          Object.fromEntries(product.listings.map((l) => [l.distributorId, l.stockStatus])),
        );
        continue;
      }
      const names = newlyInStock
        .map((l) => getDistributorById(l.distributorId)?.name ?? l.distributorId)
        .join(", ");
      const body =
        newlyInStock.length === 1
          ? `${watch.productName} is now in stock at ${names}.`
          : `${watch.productName} is now in stock at ${newlyInStock.length} distributors: ${names}.`;
      const notificationsEnabled =
        settings.notificationsEnabled !== false && settings.stockAlerts !== false;
      let notified = false;
      if (notificationsEnabled) {
        try {
          if (notify) notified = await notify("Back In Stock!", body);
          else if (Platform.OS === "web") {
            const { displayWebNotification } = await import("./web-notifications");
            notified = displayWebNotification("Back In Stock!", body);
          } else {
            const granted = await ensureNotificationPermission();
            if (granted) {
              const first = newlyInStock[0]!;
              const id = await scheduleStockAlert(
                watch.productName,
                names,
                first.price,
                first.currency,
                watch.productId,
              );
              notified = id !== null;
            }
          }
        } catch {
          notified = false;
        }
      } else {
        notified = true;
      }
      if (!notified) continue; // keep the watch; retry next cycle
      await storage.updateStockWatchStatuses(
        watch.id,
        Object.fromEntries(product.listings.map((l) => [l.distributorId, l.stockStatus])),
      );
      await storage.removeStockWatch(watch.id);
      try {
        await storage.recordNotificationEvent({
          id: `local-restock-${watch.id}-${Date.now()}`,
          type: "restock",
          title: "Back In Stock!",
          body,
          productId: watch.productId,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // History is best-effort.
      }
      continue;
    }

    // …existing per-distributor branch, unchanged…
  }
```

Keep the existing `"distributor"` body exactly as it is (it is the `else` path).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/restock-any-scope.test.ts tests/restock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/restock.ts tests/restock-any-scope.test.ts
git commit -m "feat(restock): any-distributor detection + new-source"
```

---

### Task 3: Creation UI — scope choice

**Files:** Modify `app/product/[id].tsx`

- [ ] **Step 1: Implement**

In the "Watch for restock" handler, before `addStockWatch`, present a scope choice (an `Alert.alert` with two buttons is the simplest, matching the codebase's alert usage):
- **"Any distributor"** → `scope: "any"`, `distributorId: "*"`, `distributorName: "Any distributor"`, and seed `lastKnownStatusByDistributor` from `product.listings`.
- **"This distributor"** → the existing per-distributor watch (`scope: "distributor"`).

The `addStockWatch` call for `"any"`:

```ts
          await addStockWatch({
            id: `${id}-any`,
            productId: id,
            productName: product?.name ?? "",
            distributorId: "*",
            distributorName: "Any distributor",
            reminderDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderType: "back_in_stock",
            scope: "any",
            lastKnownStatusByDistributor: Object.fromEntries(
              (product?.listings ?? []).map((l) => [l.distributorId, l.stockStatus]),
            ),
          });
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add app/product/\[id\].tsx
git commit -m "feat(restock): scope choice at watch creation"
```

---

### Task 4: Server path — upload `scope` + evaluate `"any"`

**Files:** Modify `server/routers/notifications.ts`, `server/notifications/types.ts`, `server/notifications/build-events.ts`, `lib/server-notifications.ts`, `desktop/src/server-notifications.ts`; Test `tests/server-restock-any.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/server-restock-any.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildEvents } from "../server/notifications/build-events";

// buildEvents takes an injectable price lookup. The "any" branch iterates the
// real parser ids (getAllParserIds), so key on one of them.
const getPrice = async (distributorId: string) => ({
  price: 100,
  currency: "USD",
  stockStatus: distributorId === "linitx-uk" ? "in_stock" : "back_order",
  url: "",
  fetchedAt: Date.now(),
});

describe("server restock — any scope", () => {
  it("fires when any distributor is in stock", async () => {
    const events = await buildEvents(
      {
        alerts: [],
        stockWatches: [
          { id: "w1", productId: "raspberry-pi-5-8gb", modelNumber: "SC1112", distributorId: "*", scope: "any" },
        ],
        dateReminders: [],
      } as never,
      Date.now(),
      getPrice as never,
    );
    expect(events.some((e) => e.type === "restock")).toBe(true);
  });

  it("does not fire when no distributor is in stock", async () => {
    const none = async () => ({
      price: 100, currency: "USD", stockStatus: "back_order", url: "", fetchedAt: Date.now(),
    });
    const events = await buildEvents(
      {
        alerts: [],
        stockWatches: [
          { id: "w1", productId: "raspberry-pi-5-8gb", modelNumber: "SC1112", distributorId: "*", scope: "any" },
        ],
        dateReminders: [],
      } as never,
      Date.now(),
      none as never,
    );
    expect(events.some((e) => e.type === "restock")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/server-restock-any.test.ts`
Expected: FAIL — `"*"` is looked up as a literal distributor.

- [ ] **Step 3: Implement**

In `server/notifications/types.ts`, add `scope?: "distributor" | "any";` to the `stockWatches` item.

In `server/routers/notifications.ts`, add `scope: z.enum(["distributor", "any"]).optional(),` to the `stockWatches` object schema.

In `lib/server-notifications.ts` and `desktop/src/server-notifications.ts`, add `scope: w.scope,` to the mapped stock watch.

In `server/notifications/build-events.ts`, in the `stockWatches` loop, branch:

```ts
  for (const watch of config.stockWatches) {
    const product = PRODUCT_CATALOG.find((p) => p.id === watch.productId);
    const modelNumber = watch.modelNumber ?? product?.modelNumber;
    if (!modelNumber) continue;
    if (watch.lastKnownStatus === "in_stock") continue;

    if (watch.scope === "any" || watch.distributorId === "*") {
      const ids = getAllParserIds();
      const inStock: string[] = [];
      for (const id of ids) {
        const snap = await getPrice(id, modelNumber);
        if (snap?.stockStatus === "in_stock") inStock.push(id);
      }
      if (inStock.length === 0) continue;
      const names = inStock
        .map((id) => getDistributorById(id)?.name ?? id)
        .join(", ");
      events.push({
        id: newEventId(),
        type: "restock",
        dedupKey: clampDedupKey(`restock:${watch.productId}:any`),
        title: "Back In Stock!",
        body: `${product?.name ?? watch.productId} is now available at ${names}.`,
        payload: { watchId: watch.id, productId: watch.productId, distributorId: inStock[0]! },
        createdAt: now,
      });
      continue;
    }

    // …existing per-distributor body, unchanged…
  }
```

Import `getAllParserIds` from `../scrapers/registry`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/server-restock-any.test.ts tests/notifications-*.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add server/routers/notifications.ts server/notifications/types.ts server/notifications/build-events.ts lib/server-notifications.ts desktop/src/server-notifications.ts tests/server-restock-any.test.ts
git commit -m "feat(restock): server-side any-scope evaluation + upload"
```

---

### Task 5: Watch-list UI + full verification + docs

**Files:** Modify `app/restock-watches.tsx`; `todo.md`

- [ ] **Step 1: Render "Any distributor"**

In `app/restock-watches.tsx`, where the watch's distributor name is shown, use `watch.scope === "any" ? "Any distributor" : watch.distributorName`. (The stored `distributorName` is already "Any distributor", so this is a defensive fallback for legacy rows.)

- [ ] **Step 2: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 3: Document**

Add a `todo.md` phase entry (next number 1125): the any-scope watch, new-source detection, the server parity, and the scope choice.

- [ ] **Step 4: Commit**

```bash
git add app/restock-watches.tsx todo.md
git commit -m "docs: watch-anywhere + new-source detection (Phase 1125)"
```

---

## Self-Review

- **Spec coverage:** model + helper (Task 1), client `"any"` branch (Task 2), creation UI (Task 3), server upload + evaluation (Task 4), watch-list UI + verify + docs (Task 5). The `"distributor"` path is untouched in every task.
- **Placeholders:** none — the branch code, the schema field, and the tests are given verbatim.
- **Type consistency:** `scope?: "distributor" | "any"`; `lastKnownStatusByDistributor?: Record<string, string>`; `updateStockWatchStatuses(watchId, statuses)`; the `"*"` sentinel; `dedupKey restock:${productId}:any` — used consistently across client and server.
- **Backward compatibility:** `scope` absent ⇒ `"distributor"`; existing rows and tests behave unchanged.
