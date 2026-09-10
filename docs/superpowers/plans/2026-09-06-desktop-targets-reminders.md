# Desktop Targets + Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop detail shows target coverage per distributor and creates scoped date reminders.

**Architecture:** Read-only table over existing alert state ( newly loaded); reminder modal reusing shared `Modal` + native date input writing via `addBackOrderReminder`. All in `desktop/src/pages/ProductDetail.tsx`. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-targets-reminders-design.md`

---

### Task 1: Guard tests for targets + reminders

**Files:**
- Create: `tests/desktop-targets-reminders.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop targets and reminders", () => {
  it("shows target coverage per distributor", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("scopedAlertFor");
    expect(text).toContain("Distributor Targets");
  });

  it("creates scoped date reminders", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("setReminderDistributorId(listing.distributorId)");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-targets-reminders.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-targets-reminders.test.ts
git commit -m "test: guard desktop targets and reminders"
```

---

### Task 2: Target overview table

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Load alerts + render table**

The file has NO alerts list state today — add: `const [alerts, setAlerts] = useState<PriceAlert[]>([]);` loaded in `loadProduct` via `storage.getAlerts()` filtered to `a.productId === id` (verify PriceAlert import; add type import if missing). Add imports: `scopedAlertFor, productWideAlert, alertDeltaPct` from `"../../../lib/alert-scope"` (verify path from desktop/src/pages).
Render card (after distributor rows section — read placement; sibling card classes verbatim), only when listings non-empty (mirror mobile `rows.length === 0 → null`):
```tsx
      {product.listings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Distributor Targets</p>
          {product.listings.map((listing) => {
            const alert = scopedAlertFor(alerts, product.id, listing.distributorId);
            const deltaPct = alertDeltaPct(listing, alert);
            const dist = getDistributorById(listing.distributorId);
            const met = deltaPct !== null && deltaPct <= 0;
            return (
              <div key={listing.distributorId} className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-sm">{dist?.countryFlag ?? ""}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{dist?.name ?? listing.distributorId}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatPrice(listing.price, listing.currency)}
                    {alert ? ` · target ${formatPrice(alert.targetPrice, alert.currency)}` : ""}
                  </p>
                </div>
                {alert && deltaPct !== null ? (
                  <span className={`text-sm font-bold ${met ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {deltaPct > 0 ? "+" : ""}{deltaPct}%
                  </span>
                ) : (
                  <button
                    onClick={() => setPerListingAlertId(listing.distributorId)}
                    className="w-6 h-6 rounded-full bg-brand-600/10 text-brand-600 text-sm font-bold"
                    aria-label={`Set target for ${dist?.name ?? listing.distributorId}`}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
```
Verify `setPerListingAlertId` opens the existing per-row alert modal (line ~1458 uses perListingAlertId — yes). Match button classes to file conventions (read a small round button first; adjust). `formatPrice`, `getDistributorById`, `product` in scope (verify).

- [ ] **Step 2: Verify**

Run: `pnpm vitest run tests/desktop-targets-reminders.test.ts -t "target coverage"` (passes; other fails) and `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: desktop distributor target overview. TypeScript: 0 errors."
```

---

### Task 3: Per-row reminder modal

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add per-row Remind action** (a global reminder modal with distributor scoping already exists — reuse it; do NOT build a new modal)

State: `const [reminderListing, setReminderListing] = useState<DistributorListing | null>(null);` (verify DistributorListing type import; add if missing) + `const [reminderDate, setReminderDate] = useState("");` Reset date when opening (in the row onClick: set both).
Row action (beside Watch/Bell/History/Visit — read exact actions markup): Remind button (`aria-label="Set reminder"`, icon — check lucide `BellRing`/`CalendarClock` availability in file imports; reuse an imported icon, do NOT invent) setting `reminderListing`.
Modal (shared `Modal`, `open={reminderListing !== null}`, title `Remind me`): distributor name line + `<input type="date" value={reminderDate} onChange... aria-label="Reminder date" />` + Save/Cancel. Save handler:
```tsx
  const handleSaveReminder = async () => {
    if (!product || !reminderListing || !reminderDate) return;
    const dist = getDistributorById(reminderListing.distributorId);
    await storage.addBackOrderReminder({
      id: `reminder-${product.id}-${reminderListing.distributorId}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      distributorId: reminderListing.distributorId,
      distributorName: dist?.name ?? reminderListing.distributorId,
      reminderDate: new Date(`${reminderDate}T00:00:00`).toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "date",
    });
    setReminderListing(null);
    setReminderDate("");
    showToast("Reminder set");
  };
```
Verify `storage.addBackOrderReminder` exists (full createStorage — confirm) + `showToast` in file + BackOrderReminder required fields (lib/types.ts:106-117 — no notificationId needed on desktop). try/catch → error toast/message on failure (match file pattern).

- [ ] **Step 2: Verify**

Run: full guard file (both pass) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: desktop per-row reminder creation. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in ProductDetail.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
