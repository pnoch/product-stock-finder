# Desktop Notification History + Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rust trigger events land in notification history with an unread sidebar badge.

**Architecture:** Rust emits `price-drops-triggered` (new event, existing handle); TS subscribes once in App and records via existing storage API; Sidebar badge reads unread count on mount/focus. No return-type, toast, or deactivation changes. No server/mobile changes.

**Tech Stack:** Rust (Tauri), React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-notif-history-design.md`

---

### Task 1: Guard tests for history + badges

**Files:**
- Create: `tests/desktop-notif-history.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop notification history", () => {
  it("records Rust trigger events", async () => {
    const bg = await readFile("desktop/src/background.ts", "utf8");
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(bg).toContain("price-drops-triggered");
    expect(bg).toContain("recordNotificationEvent");
    expect(app).toContain("price-drops-triggered");
  });

  it("badges unread notifications in the sidebar", async () => {
    const text = await readFile("desktop/src/components/Sidebar.tsx", "utf8");
    expect(text).toContain("getNotificationHistory");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-notif-history.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-notif-history.test.ts
git commit -m "test: guard desktop notification history and badges"
```

---

### Task 2: Rust trigger event

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Emit events payload**

Read `check_price_drops_inner` fully first (trigger loop builds `triggered: Vec<(usize, f64)>` + `notifications: Vec<(String, String)>`; product_id/product_name/target_price/alert_currency in scope per iteration; `best_price` computed). Collect an events vec in the same loop:
```rust
let mut events: Vec<serde_json::Value> = Vec::new();
// inside the trigger branch (where notifications.push happens):
events.push(serde_json::json!({
    "productId": product_id,
    "productName": product_name,
    "bestPrice": best_price,
    "currency": alert_currency,
    "targetPrice": target_price,
}));
```
After the notification-sending loop (before/after deactivation — place right after the `for (title, body) in &notifications` loop; read exact code first):
```rust
let _ = app.emit("price-drops-triggered", &events);
```
(`app` handle available — same as existing `app.emit("prices-checked", ...)` at line ~1039. `let _` ignores listener errors like existing code.)

- [ ] **Step 2: Rust unit test**

In the existing `#[cfg(test)] mod tests`: test the payload construction. Since the loop needs files, smallest meaningful test: build a sample `triggered`-style input and assert the emitted JSON shape? Emitting needs AppHandle (unavailable in unit tests). Instead extract a pure helper:
```rust
fn trigger_event_json(product_id: &str, product_name: &str, best_price: f64, currency: &str, target_price: f64) -> serde_json::Value {
    serde_json::json!({ "productId": product_id, "productName": product_name, "bestPrice": best_price, "currency": currency, "targetPrice": target_price })
}
```
Use it in the loop; unit test asserts exact keys/values. (If the loop inline-json is simpler, do that + test the helper anyway — helper is the testable unit.)

- [ ] **Step 3: Verify**

Run with workdir `desktop/src-tauri/`: `cargo test price` (or full `cargo test` if fast — read existing test count first; prefer targeted then full if time allows) + `cargo check`. Both exit 0.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "Feat: emit structured price-drop trigger events from Rust poller."
```

---

### Task 3: TS recording + badge

**Files:**
- Modify: `desktop/src/background.ts`, `desktop/src/App.tsx`, `desktop/src/components/Sidebar.tsx`

- [ ] **Step 1: Listener + recording**

In `background.ts` (mirror `onPricesChecked` at lines 47-52):
```tsx
export function onPriceDropsTriggered(
  callback: (events: Array<{ productId: string; productName: string; bestPrice: number; currency: string; targetPrice: number }>) => void,
): Promise<UnlistenFn> {
  return listen("price-drops-triggered", (event) => {
    callback(event.payload as any);
  });
}
```
In `App.tsx` beside the `onPricesChecked` subscription (~line 235, read first): subscribe once; handler (needs `storage.recordNotificationEvent` — verify desktop storage exposes it; createStorage does):
```tsx
    const unlistenTriggers = await onPriceDropsTriggered(async (events) => {
      for (const e of events ?? []) {
        try {
          await storage.recordNotificationEvent({
            id: `price-drop-${e.productId}-${Date.now()}`,
            type: "price-drop",
            title: "Price Drop Alert!",
            body: `${e.productName} is now ...`,
            productId: e.productId,
            triggeredPrice: e.bestPrice,
            currency: e.currency,
            createdAt: Date.now(),
          });
        } catch {
          // recording never breaks the check
        }
      }
    });
```
Match `NotificationHistoryEntry` fields exactly (read lib/types.ts:119-131: id/type/title/body/productId?/distributorId?/healthStatus?/triggeredPrice?/currency?/createdAt:number/read). Cleanup unlisten with the existing one (read how unlistenPromise is handled).

- [ ] **Step 2: Sidebar badge**

In `Sidebar.tsx`: load unread count on mount + window focus (`storage.getNotificationHistory()` → filter `!read`, best-effort try/catch) into local state; render bubble on the Alerts nav item when >0 (absolute-positioned count, matching file's Tailwind idioms — read nav render first; collapsed w-16 mode: badge must show on icon too). No other items change.

- [ ] **Step 3: Verify**

Run: guard file (both pass) + `pnpm check` (clean) + workdir `desktop/` `pnpm build` (exit 0).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/background.ts desktop/src/App.tsx desktop/src/components/Sidebar.tsx
git commit -m "Feat: record Rust triggers to history with sidebar badge. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Builds**

Workdir `desktop/`: `pnpm build` (exit 0). Workdir `desktop/src-tauri/`: `cargo check` + `cargo test` (exit 0; needs Rust toolchain + system deps — if unavailable in this environment, report NEEDS_CONTEXT with the exact error instead of faking it).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
