# Emoji Sweep (notification titles + flags) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining emoji — leading emoji from notification titles (mobile/desktop/server) and the `countryFlag` flag emoji (renamed to `countryCode`, ISO2 text) — guarded by a source sweep test.

**Architecture:** Two mechanical sweeps. Titles: replace each `"<emoji> Title"` with `"Title"` and update the assertions that pin them. Flags: rename the `countryFlag` field to `countryCode` across the type, the shared data, and all render sites, and replace the emoji values with ISO2 codes. A new `tests/emoji-sweep.test.ts` guards both.

**Tech Stack:** TypeScript, React Native/Expo (mobile/web), React (desktop), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-emoji-sweep-design.md`

---

## File Structure

| Area | Files |
|------|-------|
| Title sources | `lib/notifications.ts`, `lib/background-tasks/health-alerts.ts`, `lib/background-tasks/price-check.ts`, `lib/price-digest.ts`, `lib/restock.ts`, `desktop/src/lib/basket-alert.ts`, `desktop/src/lib/health-probe.ts`, `server/notifications/build-events.ts`, `server/notifications/digest.ts` |
| Pinned title tests | `tests/email-alerts-content.test.ts`, `tests/notifications.test.ts`, `tests/notifications-router.test.ts`, `tests/price-check.test.ts`, `tests/push-notifications.test.ts`, `tests/send-digest-notification.test.ts`, `tests/server-notifications.test.ts`, `tests/web-push-server.test.ts` |
| Flag type/data | `lib/types.ts`, `shared/src/distributors.ts`, `lib/watchlist-stats.ts`, `lib/price-share.ts`, `lib/watchlist-share.ts`, `server/routers/discovery.ts` |
| Flag render sites | `app/`, `components/`, `desktop/src/` (see Task 2) |
| Guards | `tests/emoji-sweep.test.ts` (new), `tests/desktop-chart-guard.test.ts` (comment only), `tests/discovery-storage.test.ts` (fixture) |

---

## Task 1: Notification-title emoji sweep

**Files:**
- Create: `tests/emoji-sweep.test.ts` (title guard)
- Modify: the nine title sources + the eight pinned test files (list above)
- Modify: `tests/desktop-chart-guard.test.ts:958-961` (comment: titles no longer keep emoji)

- [ ] **Step 1: Write the failing title guard**

Create `tests/emoji-sweep.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// Notification titles must be plain text: without a system emoji font a title
// emoji renders as an empty "tofu" box in the OS notification surface.
const TITLE_EMOJI = ["🟢", "🔴", "🟠", "📈", "💸", "📦", "📊", "💰", "✅", "🧺"];

const TITLE_SOURCES = [
  "lib/notifications.ts",
  "lib/background-tasks/health-alerts.ts",
  "lib/background-tasks/price-check.ts",
  "lib/price-digest.ts",
  "lib/restock.ts",
  "desktop/src/lib/basket-alert.ts",
  "desktop/src/lib/health-probe.ts",
  "server/notifications/build-events.ts",
  "server/notifications/digest.ts",
  "desktop/src/App.tsx",
];

describe("emoji sweep", () => {
  it("notification title sources contain no title emoji", async () => {
    for (const file of TITLE_SOURCES) {
      const src = await readFile(file, "utf8");
      for (const ch of TITLE_EMOJI) {
        expect(src.includes(ch), `${file} still contains ${ch}`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/emoji-sweep.test.ts`
Expected: FAIL (titles still contain emoji).

- [ ] **Step 3: Strip the emoji from every title**

Remove the leading emoji and the space after it, keeping the rest verbatim. Apply to:

- `lib/notifications.ts`: `"🟢 Back In Stock!"`→`"Back In Stock!"`; `"🟠 Distributor Blocked"`→`"Distributor Blocked"`; `"🔴 Distributor Down"`→`"Distributor Down"`; `"🟢 Distributor Recovered"`→`"Distributor Recovered"`; `"💰 Price Alert Set"`→`"Price Alert Set"`; `"✅ Notifications Working!"`→`"Notifications Working!"` (two sites); `"📦 Back-Order Reminder"`→`"Back-Order Reminder"`.
- `lib/background-tasks/health-alerts.ts`: `"🟠 Distributor Blocked"`→`"Distributor Blocked"`; `"🔴 Distributor Down"`→`"Distributor Down"`; `"🟢 Distributor Recovered"`→`"Distributor Recovered"`.
- `lib/background-tasks/price-check.ts`: `"🧺 Basket Alert"`→`"Basket Alert"`; `"📈 Price Increase Alert!"`→`"Price Increase Alert!"`; `"💸 Price Drop Alert!"`→`"Price Drop Alert!"`.
- `lib/price-digest.ts`: `"📊 Price Digest"`→`"Price Digest"`.
- `lib/restock.ts`: `"🟢 Back In Stock!"`→`"Back In Stock!"` (all occurrences, incl. the web path).
- `desktop/src/lib/basket-alert.ts`: `"🧺 Basket Alert"`→`"Basket Alert"` (both occurrences).
- `desktop/src/lib/health-probe.ts`: `"🟠 Distributor Blocked"`→`"Distributor Blocked"`; `"🔴 Distributor Down"`→`"Distributor Down"`; `"🟢 Distributor Recovered"`→`"Distributor Recovered"`.
- `server/notifications/build-events.ts`: `"📈 Price Increase Alert!"`→`"Price Increase Alert!"`; `"💸 Price Drop Alert!"`→`"Price Drop Alert!"`; `"🟢 Back In Stock!"`→`"Back In Stock!"`; `"📦 Back-Order Reminder"`→`"Back-Order Reminder"`.
- `server/notifications/digest.ts`: `"📊 Price Digest"`→`"Price Digest"`.

Do not touch notification **bodies** (they have no emoji) or the `↔` character in any comment.

- [ ] **Step 4: Update the assertions that pin the old titles**

In each file, replace the old emoji title string with the stripped one in the assertions:
`tests/email-alerts-content.test.ts`, `tests/notifications.test.ts`, `tests/notifications-router.test.ts`, `tests/price-check.test.ts`, `tests/push-notifications.test.ts`, `tests/send-digest-notification.test.ts`, `tests/server-notifications.test.ts`, `tests/web-push-server.test.ts`, and the **desktop** pinned tests `desktop/tests/basket-alert.test.ts` (`"🧺 Basket Alert"`), `desktop/tests/health-probe.test.tsx` (`"🟠 Distributor Blocked"`, `"🟢 Distributor Recovered"`), `desktop/tests/server-notifications.test.ts` (stale `"💸 Price Drop Alert!"` fixtures). (Run `grep -rn "🟢\|🔴\|🟠\|📈\|💸\|📦\|📊\|💰\|✅\|🧺" tests/ desktop/tests/` to find them all; zero title-emoji assertions must remain in those files.)

- [ ] **Step 5: Update the stale guard comment**

In `tests/desktop-chart-guard.test.ts` (around lines 958-961), the comment says notification titles "deliberately keep theirs" — that is no longer true. Change that sentence to note titles are now emoji-free and are covered by `tests/emoji-sweep.test.ts`.

- [ ] **Step 6: Run the guard + the touched tests**

Run: `pnpm vitest run tests/emoji-sweep.test.ts tests/email-alerts-content.test.ts tests/notifications.test.ts tests/notifications-router.test.ts tests/price-check.test.ts tests/push-notifications.test.ts tests/send-digest-notification.test.ts tests/server-notifications.test.ts tests/web-push-server.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/notifications.ts lib/background-tasks/health-alerts.ts lib/background-tasks/price-check.ts lib/price-digest.ts lib/restock.ts desktop/src/lib/basket-alert.ts desktop/src/lib/health-probe.ts server/notifications/build-events.ts server/notifications/digest.ts tests/emoji-sweep.test.ts tests/desktop-chart-guard.test.ts tests/email-alerts-content.test.ts tests/notifications.test.ts tests/notifications-router.test.ts tests/price-check.test.ts tests/push-notifications.test.ts tests/send-digest-notification.test.ts tests/server-notifications.test.ts tests/web-push-server.test.ts desktop/tests/basket-alert.test.ts desktop/tests/health-probe.test.tsx desktop/tests/server-notifications.test.ts
git commit -m "refactor: remove emoji from notification titles"
```

---

## Task 2: `countryFlag` → `countryCode`

**Files:**
- Modify: `tests/emoji-sweep.test.ts` (add the flag guard)
- Modify: `lib/types.ts`, `shared/src/distributors.ts`, `lib/watchlist-stats.ts`, `lib/price-share.ts`, `lib/watchlist-share.ts`, `server/routers/discovery.ts`, all `app/`/`components/`/`desktop/src/` render sites
- Modify: `tests/discovery-storage.test.ts` (fixture)

- [ ] **Step 1: Add the failing flag guard**

In `tests/emoji-sweep.test.ts`, change the top import to also bring in `readdir` and `path`:

```ts
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
```

Add a `walk` helper above the `describe`, and add this `it(...)` **inside the existing `describe("emoji sweep", ...)` block** (do not add a second `describe`):

```ts
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|\.expo|dist/.test(p)) out.push(...(await walk(p)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}
```

```ts
  it("has no countryFlag identifier or regional-indicator emoji", async () => {
    const roots = ["lib", "app", "components", "desktop/src", "shared", "server"];
    for (const root of roots) {
      for (const file of await walk(root)) {
        const src = await readFile(file, "utf8");
        expect(src.includes("countryFlag"), `${file} still uses countryFlag`).toBe(false);
      }
    }
    for (const file of await walk("shared")) {
      const src = await readFile(file, "utf8");
      expect(/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(src), `${file} has a flag emoji`).toBe(false);
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/emoji-sweep.test.ts`
Expected: FAIL (`countryFlag` present).

- [ ] **Step 3: Rename the type + data**

- `lib/types.ts`: `countryFlag: string;` → `countryCode: string;`.
- `lib/watchlist-stats.ts`: `countryFlag: string;` in its local type → `countryCode: string;` (and its use at line ~107).
- `shared/src/distributors.ts`: replace each `countryFlag: "<flag>"` with `countryCode: "<CODE>"` using:

  Malaysia `MY`, United Kingdom `GB`, Poland `PL`, European Union `EU`, Greece `GR`, Germany `DE`, South Africa `ZA`, UAE `AE`, United States `US`, Australia `AU`, New Zealand `NZ`, Czech Republic `CZ`, Canada `CA`.

- [ ] **Step 4: Rename every other reference**

Replace the identifier `countryFlag` → `countryCode` everywhere it remains (render sites in `app/`, `components/`, `desktop/src/`, and `server/routers/discovery.ts`; helper types in `lib/price-share.ts`, `lib/watchlist-share.ts`). Then confirm completeness:

```bash
grep -rn "countryFlag" lib app components desktop/src shared server tests
```

(Only `tests/emoji-sweep.test.ts`'s guard string and `tests/discovery-storage.test.ts`'s fixture may remain — fix the fixture in Step 5.)

- [ ] **Step 5: Update the test fixtures / assertions**

Run `grep -rn "countryFlag\|🇺🇸\|🇬🇧\|🇲🇾\|countryCode" tests/ desktop/tests/` and update:
- `tests/discovery-storage.test.ts`, `countryFlag: "🇺🇸"` → `countryCode: "US"` (and any `.countryFlag` read in that test).
- `desktop/tests/ux-alignment.test.tsx:107`, the assertion `🇺🇸 Baltic Networks` → `US Baltic Networks` (it renders the distributor's `countryCode`).
- any other test hit the grep finds.

- [ ] **Step 6: Run the guard + typecheck**

Run: `pnpm vitest run tests/emoji-sweep.test.ts && pnpm check && pnpm check:desktop`
Expected: PASS; 0 TypeScript errors on both (tsc proves no reference was missed).

- [ ] **Step 7: Commit**

```bash
git add lib app components desktop/src shared server tests
git commit -m "refactor: rename countryFlag to countryCode (ISO2 text)"
```

---

## Task 3: Full verification + docs

- [ ] **Step 1: Run everything**

Run: `pnpm check && pnpm lint && pnpm test && pnpm check:desktop && pnpm --dir desktop test`
Expected: root + desktop 0 TypeScript errors, lint 0 errors, all tests pass.

- [ ] **Step 2: Append the phase entry to `todo.md`**

```md
## Phase 1042: Emoji sweep — notification titles + flags

- [x] Removed the leading emoji from every notification title on mobile, desktop, and server (24 strings across 9 files); bodies were already emoji-free. Updated the 8 test files that pinned the old titles.
- [x] Renamed `Distributor.countryFlag` → `countryCode` (ISO 3166-1 alpha-2) across the type, `shared/src/distributors.ts` data, and all 82 references (mobile/desktop/server + share helpers); the flag emoji are now `MY`/`GB`/`EU`/… text.
- [x] New `tests/emoji-sweep.test.ts` guards: no title emoji in the 9 title sources, no `countryFlag` identifier, no regional-indicator emoji in `shared/`.
- [x] `tsc 0` (root + desktop), lint 0 errors, root + desktop suites green.
```

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "Docs: emoji sweep phase entry (Phase 1042)"
```
