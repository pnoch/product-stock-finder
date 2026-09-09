# Desktop Notification Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop Settings exposes health alerts, digest day, and quiet hours controls.

**Architecture:** Three additions to the Notifications section of `desktop/src/pages/Settings.tsx` reusing its toggle-row and segmented patterns against existing `AppSettings` keys. No scheduling or server changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-notif-settings-design.md`

---

### Task 1: Guard tests for notification settings

**Files:**
- Create: `tests/desktop-notif-settings.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop notification settings", () => {
  it("has a health alerts toggle", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("healthAlerts");
    expect(text).toContain("Health Alerts");
  });

  it("has digest-day and quiet-hours pickers", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("digestDayOfWeek");
    expect(text).toContain("Quiet Hours");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-notif-settings.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-notif-settings.test.ts
git commit -m "test: guard desktop notification settings parity"
```

---

### Task 2: Health toggle + digest day + quiet hours

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

Read the Notifications section first (priceAlerts row ~966-972, test button ~987). The `update()` helper merges partials (used as `update({ priceAlerts: ... })`).

- [ ] **Step 1: Health Alerts row**

After the priceAlerts row, insert (same label/checkbox/disabled pattern):
```tsx
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Health Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Notify when a distributor is blocked or down</span>
            </span>
            <input
              type="checkbox"
              checked={settings.healthAlerts}
              onChange={(e) => update({ healthAlerts: e.target.checked })}
              disabled={!settings.notificationsEnabled}
              className="w-4 h-4 accent-brand-600"
              aria-label="Enable health alerts"
            />
          </label>
```
Match the exact row markup of the priceAlerts row (read first; adjust classes only to match — verify `accent-brand-600` is what siblings use).

- [ ] **Step 2: Digest-day picker**

After the digest-frequency segmented control (in/after the Price Digest section ~1156-1170 — or inside Notifications? The frequency control lives in Price Digest section; place the day picker directly beneath it):
```tsx
          {settings.digestFrequency === "weekly" && (
            <div className="flex gap-2 mt-3 flex-wrap" role="group" aria-label="Digest day">
              {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day, i) => (
                <button
                  key={day}
                  onClick={() => update({ digestDayOfWeek: i })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    (settings.digestDayOfWeek ?? 0) === i
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                  aria-label={`Set digest day to ${day}`}
                >
                  {day}
                </button>
              ))}
            </div>
          )}
```
Match segmented classes to the frequency control exactly (read first).

- [ ] **Step 3: Quiet-hours picker**

In the Notifications section (after toggles, before test button — read order first):
```tsx
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Quiet Hours</p>
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Quiet hours">
              {(["Off", "22:00–07:00", "23:00–07:00", "00:00–08:00"] as const).map((opt) => {
                const active = !settings.quietHours ? opt === "Off" : `${settings.quietHours.start}–${settings.quietHours.end}` === opt;
                return (
                  <button
                    key={opt}
                    onClick={() =>
                      update(
                        opt === "Off"
                          ? { quietHours: undefined }
                          : (() => {
                              const [start, end] = opt.split("–");
                              return { quietHours: { start, end } };
                            })(),
                      )
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                    aria-label={opt === "Off" ? "Turn off quiet hours" : `Set quiet hours to ${opt}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {settings.quietHours && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Health alerts and digests are muted during quiet hours.
              </p>
            )}
          </div>
```
The "–" is U+2013 EN DASH (same as mobile splits on) — copy exactly. `update({ quietHours: undefined })` must typecheck against Partial<AppSettings> (quietHours is optional — verify; if tsc complains, cast or check how mobile clears it — mobile passes undefined too).

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/desktop-notif-settings.test.ts` (both pass) and `pnpm check` (clean).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: desktop notification settings parity (health, digest day, quiet hours). TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Settings.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
