# Time-Based Price History Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the point-count history cap with time-based retention — at most one price point per UTC day, keeping a rolling 90-day window — on both mobile (TypeScript) and desktop (Rust).

**Architecture:** A pure `appendPricePoint(history, point, maxDays)` helper in `lib/price-history.ts` used by both mobile scrape paths in `lib/background-price-check.ts`, plus a mirrored Rust function `append_price_point_with_retention` in `desktop/src-tauri/src/lib.rs` called from `update_listing_price`. The helper replaces a same-day point (keeping the latest scrape + stockStatus), otherwise appends, then prunes points older than `maxDays`.

**Tech Stack:** TypeScript 5.9 (strict), vitest, Rust 1.92 (serde_json), Tauri 2.

---

### Task 1: Write failing tests for `appendPricePoint`

**Files:**
- Create: `tests/price-history.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, expect, it } from "vitest";
import { appendPricePoint } from "../lib/price-history";
import type { PricePoint, StockStatus } from "../lib/types";

function point(
  date: string,
  price: number,
  stockStatus: StockStatus = "in_stock",
): PricePoint {
  return { date, price, currency: "USD", stockStatus };
}

describe("appendPricePoint", () => {
  const NOW = "2026-08-11T12:00:00.000Z";

  it("appends a new-day point in chronological order", () => {
    const history = [point("2026-08-10T09:00:00.000Z", 100)];
    const result = appendPricePoint(
      history,
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result.map((p) => p.date.slice(0, 10))).toEqual([
      "2026-08-10",
      "2026-08-11",
    ]);
    expect(result[1].price).toBe(105);
  });

  it("replaces a point on the same UTC day", () => {
    const history = [point("2026-08-11T08:00:00.000Z", 100)];
    const result = appendPricePoint(
      history,
      point("2026-08-11T20:00:00.000Z", 108),
      90,
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(108);
    expect(result[0].date).toBe("2026-08-11T20:00:00.000Z");
  });

  it("preserves the latest stockStatus on same-day replacement", () => {
    const history = [point("2026-08-11T08:00:00.000Z", 100, "back_order")];
    const result = appendPricePoint(
      history,
      point("2026-08-11T20:00:00.000Z", 100, "in_stock"),
      90,
      NOW,
    );
    expect(result[0].stockStatus).toBe("in_stock");
  });

  it("prunes points older than maxDays", () => {
    const history = [
      point("2026-05-10T09:00:00.000Z", 90),
      point("2026-06-01T09:00:00.000Z", 95),
    ];
    const result = appendPricePoint(
      history,
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result.map((p) => p.date.slice(0, 10))).toEqual([
      "2026-06-01",
      "2026-08-11",
    ]);
  });

  it("keeps a point exactly maxDays old (inclusive boundary)", () => {
    const exactly = "2026-05-13T12:00:00.000Z"; // 90 days before NOW
    const result = appendPricePoint(
      [point(exactly, 100)],
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result).toHaveLength(2);
  });

  it("returns a single-point history when history is empty", () => {
    const result = appendPricePoint(
      [],
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(105);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/price-history.test.ts`
Expected: FAIL — `Cannot find module '../lib/price-history'`

- [ ] **Step 3: Commit**

```bash
git add tests/price-history.test.ts
git commit -m "test: add failing appendPricePoint tests"
```

---

### Task 2: Implement `appendPricePoint` helper

**Files:**
- Create: `lib/price-history.ts`

- [ ] **Step 1: Write the implementation**

```ts
import type { PricePoint } from "@/lib/types";

export function appendPricePoint(
  history: PricePoint[],
  point: PricePoint,
  maxDays = 90,
  now = new Date().toISOString(),
): PricePoint[] {
  const day = point.date.slice(0, 10);
  const existingIdx = history.findIndex(
    (p) => p.date.slice(0, 10) === day,
  );

  const result =
    existingIdx >= 0
      ? history.map((p, i) => (i === existingIdx ? point : p))
      : [...history, point];

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxDays);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  return result.filter((p) => p.date.slice(0, 10) >= cutoffDay);
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test tests/price-history.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: 0 TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add lib/price-history.ts
git commit -m "feat: add appendPricePoint with time-based retention"
```

---

### Task 3: Wire `appendPricePoint` into mobile scrape paths

**Files:**
- Modify: `lib/background-price-check.ts:17` (constant), `:102-107` (background task), `:285-290` (foreground check)

- [ ] **Step 1: Rename the constant**

Replace line 17:

```ts
const MAX_PRICE_HISTORY = 90;
```

with:

```ts
const PRICE_HISTORY_DAYS = 90;
```

- [ ] **Step 2: Add the import**

After the existing `import { PricePoint, DistributorListing } from "./types";` line, add:

```ts
import { appendPricePoint } from "./price-history";
```

- [ ] **Step 3: Replace both `priceHistory` constructions**

In the background task, replace:

```ts
                  priceHistory: [
                    ...listing.priceHistory,
                    newPricePoint,
                  ].slice(-MAX_PRICE_HISTORY),
```

with:

```ts
                  priceHistory: appendPricePoint(
                    listing.priceHistory,
                    newPricePoint,
                    PRICE_HISTORY_DAYS,
                  ),
```

In `checkPriceDropsNow`, replace:

```ts
                priceHistory: [
                  ...listing.priceHistory,
                  newPricePoint,
                ].slice(-MAX_PRICE_HISTORY),
```

with:

```ts
                priceHistory: appendPricePoint(
                  listing.priceHistory,
                  newPricePoint,
                  PRICE_HISTORY_DAYS,
                ),
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm check`
Expected: 0 TypeScript errors

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: PASS — all tests (price-history + existing)

- [ ] **Step 6: Commit**

```bash
git add lib/background-price-check.ts
git commit -m "feat: use time-based price history retention in scrape paths"
```

---

### Task 4: Write failing Rust tests for retention helpers

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs` (add `#[cfg(test)] mod tests` at end of file, after line 810)

- [ ] **Step 1: Add the test module**

Append to the end of `desktop/src-tauri/src/lib.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn point(ts: &str, price: f64) -> serde_json::Value {
        serde_json::json!({
            "date": ts,
            "price": price,
            "currency": "USD",
            "stockStatus": "in_stock",
        })
    }

    #[test]
    fn iso_date_from_secs_returns_iso_date() {
        // 2026-08-11T00:00:00Z = 1786406400 epoch seconds
        assert_eq!(iso_date_from_secs(1786406400), "2026-08-11");
    }

    #[test]
    fn replaces_point_on_same_utc_day() {
        let mut history = vec![point("2026-08-11T08:00:00.000Z", 100.0)];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T20:00:00.000Z", 108.0),
            "2026-05-13",
        );
        assert_eq!(history.len(), 1);
        assert_eq!(history[0]["price"], 108.0);
        assert_eq!(history[0]["date"], "2026-08-11T20:00:00.000Z");
    }

    #[test]
    fn appends_new_day_point() {
        let mut history = vec![point("2026-08-10T09:00:00.000Z", 100.0)];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T09:00:00.000Z", 105.0),
            "2026-05-13",
        );
        assert_eq!(history.len(), 2);
        assert_eq!(history[1]["date"], "2026-08-11T09:00:00.000Z");
    }

    #[test]
    fn prunes_points_older_than_cutoff() {
        let mut history = vec![
            point("2026-05-10T09:00:00.000Z", 90.0),
            point("2026-06-01T09:00:00.000Z", 95.0),
        ];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T09:00:00.000Z", 105.0),
            "2026-05-13",
        );
        let dates: Vec<&str> = history
            .iter()
            .map(|p| &p["date"].as_str().unwrap()[..10])
            .collect();
        assert_eq!(dates, vec!["2026-06-01", "2026-08-11"]);
    }

    #[test]
    fn keeps_point_exactly_at_cutoff() {
        let mut history = vec![point("2026-05-13T09:00:00.000Z", 100.0)];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T09:00:00.000Z", 105.0),
            "2026-05-13",
        );
        assert_eq!(history.len(), 2);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test` (workdir `desktop/src-tauri`)
Expected: FAIL — `error[E0425]: cannot find function iso_date_from_secs` / `append_price_point_with_retention`

Note: first run may take a few minutes as cargo builds the tauri dependency tree.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "test: add failing Rust retention tests"
```

---

### Task 5: Implement Rust retention helpers and wire into `update_listing_price`

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs` (add helpers after `current_iso_timestamp` at line 671; replace history append in `update_listing_price` at lines 572-588)

- [ ] **Step 1: Add the helpers**

After the closing brace of `current_iso_timestamp` (line 671), before the `// ─── Tray Badge ───` banner, add:

```rust
// ─── Price History Retention ────────────────────────────────────────────────

fn iso_date_prefix(ts: &str) -> &str {
    ts.get(..10).unwrap_or(ts)
}

fn iso_date_from_secs(secs: u64) -> String {
    let days = secs / 86400;
    let mut year = 1970i64;
    let mut remaining_days = days as i64;
    loop {
        let days_in_year = if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
            366
        } else {
            365
        };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }
    let mut month = 1u32;
    let mut remaining = remaining_days as u32;
    let month_lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (i, &ml) in month_lengths.iter().enumerate() {
        let dim = if i == 1 && ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {
            29
        } else {
            ml
        };
        if remaining < dim {
            break;
        }
        remaining -= dim;
        month += 1;
    }
    let day = remaining + 1;
    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn append_price_point_with_retention(
    history: &mut Vec<serde_json::Value>,
    point: serde_json::Value,
    cutoff_day: &str,
) {
    let today = point
        .get("date")
        .and_then(|d| d.as_str())
        .map(iso_date_prefix)
        .unwrap_or_default()
        .to_string();

    let same_day = history.iter_mut().find(|p| {
        p.get("date")
            .and_then(|d| d.as_str())
            .map(iso_date_prefix)
            == Some(today.as_str())
    });

    match same_day {
        Some(existing) => *existing = point,
        None => history.push(point),
    }

    history.retain(|p| {
        p.get("date")
            .and_then(|d| d.as_str())
            .map(|d| iso_date_prefix(d) >= cutoff_day)
            .unwrap_or(true)
    });
}
```

- [ ] **Step 2: Replace the history append in `update_listing_price`**

Replace the block in `update_listing_price` (lines 572-588):

```rust
                // Append a price point to history so the compare chart stays fresh
                let point = serde_json::json!({
                    "date": current_iso_timestamp(),
                    "price": scrape.price,
                    "currency": scrape.currency,
                    "stockStatus": scrape.stock_status,
                });
                let history = obj
                    .get_mut("priceHistory")
                    .and_then(|v| v.as_array_mut());
                match history {
                    Some(arr) => arr.push(point),
                    None => {
                        obj.insert("priceHistory".to_string(), serde_json::json!([point]));
                    }
                }
```

with:

```rust
                // Append a price point to history so the compare chart stays fresh,
                // replacing the same-day point and pruning to a 90-day window.
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let cutoff_day = iso_date_from_secs(now.saturating_sub(90 * 86400));
                let point = serde_json::json!({
                    "date": current_iso_timestamp(),
                    "price": scrape.price,
                    "currency": scrape.currency,
                    "stockStatus": scrape.stock_status,
                });
                match obj.get_mut("priceHistory").and_then(|v| v.as_array_mut()) {
                    Some(arr) => append_price_point_with_retention(arr, point, &cutoff_day),
                    None => {
                        obj.insert("priceHistory".to_string(), serde_json::json!([point]));
                    }
                }
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cargo test` (workdir `desktop/src-tauri`)
Expected: PASS — 4 retention tests green

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat: bound desktop price history to 90-day window"
```

---

### Task 6: Update todo.md and final verification

**Files:**
- Modify: `todo.md` (append Phase 24 section)

- [ ] **Step 1: Append Phase 24 to todo.md**

Add at the end of `todo.md`:

```markdown
## Phase 24: Time-Based Price History Retention

- [x] Create shared appendPricePoint helper (lib/price-history.ts) with time-based retention (1 point per UTC day, 90-day window)
- [x] Unit tests for appendPricePoint (6 tests)
- [x] Wire appendPricePoint into both mobile scrape paths (background task + foreground check)
- [x] Rename MAX_PRICE_HISTORY to PRICE_HISTORY_DAYS
- [x] Rust append_price_point_with_retention + iso_date_from_secs helpers (desktop)
- [x] Rust retention tests (4 tests)
- [x] Bound desktop history growth in update_listing_price (was unbounded)
```

- [ ] **Step 2: Run all verification**

Run: `pnpm check` — Expected: 0 TypeScript errors
Run: `pnpm lint` — Expected: no lint errors
Run: `pnpm test` — Expected: all tests pass
Run: `cargo test` (workdir `desktop/src-tauri`) — Expected: all Rust tests pass

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: add Phase 24 time-based price history retention to todo.md"
```
