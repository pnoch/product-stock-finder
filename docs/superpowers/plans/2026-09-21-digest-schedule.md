# Digest Schedule Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digest frequency + day-of-week pickers in Settings; weekly digests fire on the chosen weekday.

**Architecture:** `digestDayOfWeek?: number` on AppSettings; `maybeSendDigest` weekly branch adds weekday gate; two PillPicker rows in the notifications settings section.

**Tech Stack:** TypeScript strict, vitest, React Native.

---

## File Structure

| File | Change |
|------|--------|
| `lib/types.ts` | `AppSettings.digestDayOfWeek?: number` |
| `lib/price-digest.ts` | weekday gate |
| `tests/price-digest.test.ts` | weekday-gate cases |
| `components/settings/notifications-section.tsx` | frequency + day pickers |
| `todo.md` | append Phase 105 |

---

## Task 1: Type + gate + UI

**Files:** all of the above + todo.md

- [ ] **Step 1: Type**

`lib/types.ts` — AppSettings gains:
```typescript
  digestDayOfWeek?: number; // 0=Sunday..6=Saturday, used when digestFrequency=weekly
```

- [ ] **Step 2: Tests first**

Extend `tests/price-digest.test.ts` — add to the maybeSendDigest describe (reuse its fixture style):

```typescript
  it("weekly fires only on the chosen weekday", async () => {
    const send = vi.fn(async () => {});
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-10T12:00:00.000Z", // Monday
      products: [],
    };
    const watchlist = [
      makeProduct("p1", "A", [{ price: 100, currency: "USD", stockStatus: "in_stock" }]),
    ];
    // NOW is Saturday (+2d) — past interval but wrong weekday
    const wrongDay = await maybeSendDigest(
      previous,
      watchlist,
      makeSettings({ digestFrequency: "weekly", digestDayOfWeek: 0 }),
      [],
      send,
      NOW,
    );
    expect(wrongDay).toBeNull();
    expect(send).not.toHaveBeenCalled();

    // Sunday (+1d... use next Sunday = +6d from Monday) — correct weekday
    const sunday = new Date(Date.parse("2026-08-16T12:00:00Z")).toISOString(); // Sunday
    const rightDay = await maybeSendDigest(
      { ...previous, lastDigestAt: "2026-08-09T12:00:00.000Z" },
      watchlist,
      makeSettings({ digestFrequency: "weekly", digestDayOfWeek: 0 }),
      [],
      send,
      sunday,
    );
    expect(rightDay).not.toBeNull();
    expect(send).toHaveBeenCalled();
  });

  it("daily ignores the weekday gate", async () => {
    const send = vi.fn(async () => {});
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-14T12:00:00.000Z",
      products: [],
    };
    const result = await maybeSendDigest(
      previous,
      [
        makeProduct("p1", "A", [{ price: 100, currency: "USD", stockStatus: "in_stock" }]),
      ],
      makeSettings({ digestFrequency: "daily" }),
      [],
      send,
      NOW, // Saturday
    );
    expect(result).not.toBeNull();
    expect(send).toHaveBeenCalled();
  });
```

(NOW/LAST constants and makeProduct/makeSettings already exist in this file.)

- [ ] **Step 3: Run tests to verify new cases fail**

Run: `pnpm vitest run tests/price-digest.test.ts` — FAIL on the weekly case (fires without weekday match).

- [ ] **Step 4: Weekday gate in `lib/price-digest.ts`**

In `maybeSendDigest`, replace:

```typescript
    const intervalMs = frequency === "weekly" ? 7 * 86400000 : 86400000;
    if (previous) {
      const elapsed =
        new Date(now).getTime() - new Date(previous.lastDigestAt).getTime();
      if (elapsed < intervalMs) return null;
    }
```

with:

```typescript
    const intervalMs = frequency === "weekly" ? 7 * 86400000 : 86400000;
    if (previous) {
      const elapsed =
        new Date(now).getTime() - new Date(previous.lastDigestAt).getTime();
      if (elapsed < intervalMs) return null;
      if (
        frequency === "weekly" &&
        new Date(now).getDay() !== (settings.digestDayOfWeek ?? 0)
      ) {
        return null;
      }
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/price-digest.test.ts` — PASS all.

- [ ] **Step 6: Settings UI**

In `components/settings/notifications-section.tsx`, after the Health Alerts SettingRow:

```tsx
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <PillPicker
            icon="newspaper.fill"
            label="Price Digest"
            options={["Off", "Daily", "Weekly"]}
            value={
              settings.digestFrequency === "daily"
                ? "Daily"
                : settings.digestFrequency === "weekly"
                  ? "Weekly"
                  : "Off"
            }
            onSelect={(v) =>
              updateSetting(
                "digestFrequency",
                v === "Daily" ? "daily" : v === "Weekly" ? "weekly" : "off",
              )
            }
          />
          {settings.digestFrequency === "weekly" && (
            <PillPicker
              icon="calendar"
              label="Digest Day"
              options={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
              value={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                settings.digestDayOfWeek ?? 0
              ]}
              onSelect={(v) =>
                updateSetting(
                  "digestDayOfWeek",
                  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v),
                )
              }
            />
          )}
        </View>
```

Add import `import { PillPicker } from "@/components/settings/pill-picker";`. ICON CHECK: verify `newspaper.fill` mapped; fallback to a mapped icon if not.

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 105 section:

```markdown
## Phase 105: Digest Schedule Settings (v6.5)

- [x] Add digestDayOfWeek setting
- [x] Weekly digests fire on the chosen weekday
- [x] Add Price Digest frequency + day pickers to Settings (fixes missing enable UI)
```

Then:

```bash
git add lib/types.ts lib/price-digest.ts tests/price-digest.test.ts components/settings/notifications-section.tsx todo.md && git commit -m "feat: add digest schedule settings"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New setting | `digestDayOfWeek?: number` |
| Fixed | digest enable UI was missing entirely |
| New tests | ~2 cases |
