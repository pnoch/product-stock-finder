import { describe, expect, it } from "vitest";
import { sanitizeHistoryPoints } from "../shared/src/history-upload";
import { MAX_UPLOAD_HISTORY_POINTS } from "../shared/const";

function point(overrides: Record<string, unknown> = {}) {
  return {
    date: new Date(Date.now() - 86_400_000).toISOString(),
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    ...overrides,
  } as never;
}

describe("sanitizeHistoryPoints", () => {
  it("drops points the server's uploadHistory schema would reject", () => {
    const now = Date.now();
    const kept = sanitizeHistoryPoints([
      point(),
      // Date-only (a legacy/imported shape): the server regex is strict.
      point({ date: "2026-08-10" }),
      // Non-UTC offset.
      point({ date: "2026-08-10T09:00:00+02:00" }),
      // More than an hour in the future.
      point({ date: new Date(now + 7_200_000).toISOString() }),
      // Out of the decimal(12,4) range / non-positive.
      point({ price: 100_000_000 }),
      point({ price: 0 }),
      point({ price: Number.NaN }),
      // Currency too long for the column.
      point({ currency: "US DOLLARS" }),
      // Not a known stock status.
      point({ stockStatus: "discontinued" }),
    ]);
    expect(kept).toHaveLength(1);
  });

  it("keeps the newest points when over the upload cap", () => {
    // Ascending input (oldest first).
    const points = Array.from(
      { length: MAX_UPLOAD_HISTORY_POINTS + 50 },
      (_, i) =>
        point({ date: new Date(Date.now() - (i + 1) * 60_000).toISOString() }),
    ).reverse();
    const kept = sanitizeHistoryPoints(points);
    expect(kept).toHaveLength(MAX_UPLOAD_HISTORY_POINTS);
    // The newest point (last in ascending order) is kept.
    expect(kept[kept.length - 1]).toEqual(points[points.length - 1]);
  });

  it("preserves valid points in order", () => {
    const a = point({ price: 10 });
    const b = point({ price: 20 });
    expect(sanitizeHistoryPoints([a, b])).toEqual([a, b]);
  });

  it("keeps the newest points even when the input is not sorted", () => {
    // A history restored from a backup or a server pull is not guaranteed
    // ascending; `slice(-N)` on a descending array kept the OLDEST points.
    const newest = point({
      date: new Date().toISOString(),
      price: 1,
    });
    const points = [
      newest,
      ...Array.from({ length: MAX_UPLOAD_HISTORY_POINTS + 50 }, (_, i) =>
        point({
          date: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
          price: 100 + i,
        }),
      ),
    ];
    const kept = sanitizeHistoryPoints(points);
    expect(kept).toHaveLength(MAX_UPLOAD_HISTORY_POINTS);
    expect(kept.some((p) => (p as { price: number }).price === 1)).toBe(true);
  });
});
