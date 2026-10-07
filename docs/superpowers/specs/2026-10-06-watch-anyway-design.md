# Watch-Anyway When Out of Stock — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Make the restock watch available on the **product**, not just on a listing, so a
user can turn on the radar for a part that is currently out of stock everywhere —
the exact moment the app was built for.

## Problem

The watch action lives on a listing card (`handleToggleStockWatch(listing)`).
When a product is out of stock at all 25 distributors — the CRS804 scenario —
there are no listing cards, the empty state is a dead-end alert
(`"No prices found"`), and the user **cannot watch the part that needs it most**.
The scarcity radar has a hole exactly where scarcity is highest.

## Scope

**In scope:** an always-available product-level watch button in the
product-detail header, an actionable empty state, a `toggleAnyWatch` refactor,
and tests.

**Out of scope:** desktop parity (desktop cannot create any-watches yet — a
separate plan); the per-listing scope dialog (behavior unchanged).

## Architecture

### 1. Extract `toggleAnyWatch` — `app/product/[id].tsx`

Pull the any-watch create/remove out of `handleToggleStockWatch` into a
standalone callback so both the header button and the empty state can call it
without the scope dialog:

```ts
const toggleAnyWatch = useCallback(async () => {
  if (!id || togglingWatch) return;
  setTogglingWatch(true);
  try {
    if (stockWatches["*"]) {
      const watches = await getStockWatches();
      const watch = watches.find((w) => w.productId === id && w.distributorId === "*");
      if (watch) {
        if (watch.notificationId) await cancelNotification(watch.notificationId);
        await removeStockWatch(watch.id);
      }
      setStockWatches((prev) => ({ ...prev, "*": false }));
      showToast("Stopped watching all distributors", "info");
    } else {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        showAlert("Permission Denied", "Please enable notifications to watch for restocks.");
        return;
      }
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
          listings.map((l) => [l.distributorId, l.stockStatus]),
        ),
      });
      setStockWatches((prev) => ({ ...prev, "*": true }));
      showToast("Watching all distributors — you'll be notified when it's back in stock", "success");
    }
  } catch {
    showAlert("Couldn't update watch", "Please try again.");
  } finally {
    setTogglingWatch(false);
  }
}, [id, product, listings, stockWatches, togglingWatch, showToast]);
```

`handleToggleStockWatch` keeps its per-listing behavior (the scope dialog);
its `createAnyWatch` closure can call the same body or be left as-is — the
plan will dedupe to a single shared helper.

### 2. Header button — `components/product/detail-header.tsx`

`DetailHeader` gains props:

```ts
watchingAny: boolean;
onToggleWatch: () => void;
```

It renders a button below the model line (always visible, regardless of
listings):
- Not watching → **"Watch for restock"** (bell icon, `colors.primary`).
- Watching → **"Watching — tap to stop"** (filled bell, `colors.success`).
- `accessibilityLabel` reflects the state; `accessibilityRole="button"`.

`app/product/[id].tsx` passes `watchingAny={!!stockWatches["*"]}` and
`onToggleWatch={() => void toggleAnyWatch()}`.

### 3. Actionable empty state — `components/product/distributor-listing-section.tsx`

The listing section's empty state (`sortedListings.length === 0`, line ~191)
already renders a "Find prices" button. Add a second **"Watch anyway"** button
beside it (same styling, `colors.primary` outline) that calls a new
`onWatchAny` prop → `toggleAnyWatch()`. The dead-end becomes an action.

`app/product/[id].tsx` passes `onWatchAny={() => void toggleAnyWatch()}` and
`watchingAny={!!stockWatches["*"]}` to the section (the latter so the empty-state
button can read "Watching — tap to stop" when already watching).

## Data Flow

1. User opens a product that is out of stock everywhere.
2. The header shows "Watch for restock"; the empty state shows "Watch anyway".
3. Tapping either calls `toggleAnyWatch()` → creates the `scope: "any"` watch
   (seed map empty when there are no listings, so the first check fires when
   anything appears).
4. The button flips to "Watching — tap to stop".

## Error Handling

- Permission denied → alert, no watch created (existing pattern).
- Storage failure → alert, state unchanged.
- `togglingWatch` guards double-taps.

## Testing

- `tests/detail-header-watch.test.tsx` — the header renders "Watch for restock"
  when `watchingAny` is false and "Watching" when true; the button calls
  `onToggleWatch`.
- `tests/toggle-any-watch.test.ts` (or extend an existing product-detail test) —
  `toggleAnyWatch` creates an `"*"` watch when none exists and removes it when
  one does; permission-denied creates nothing.
- `tests/listing-empty-watch.test.tsx` — the empty state renders "Watch anyway"
  and calls `onWatchAny`.
- Existing product-detail / restock tests stay green.

## Success Criteria

- A product with zero in-stock listings offers a working "Watch for restock"
  action (header + empty state).
- The button reflects the any-watch state.
- `pnpm verify` stays green.

## Risks

- **Header clutter** → one button below the model line; the header already
  carries name/brand/region.
- **Duplicate any-watch paths** → the plan dedupes to one `toggleAnyWatch` body
  shared by the header, the empty state, and the per-listing dialog's
  "Any distributor" option.
