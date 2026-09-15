import { describe, expect, it } from "vitest";

// Mirrors components/stats/drop-calendar-card.tsx buildGridCells (not exported).
function buildGridCells(days: number, now: number): (number | null)[] {
  const cells: (number | null)[] = [];
  const nowDate = new Date(now);
  const todayMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  );
  const dayTs: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(
      todayMidnight.getFullYear(),
      todayMidnight.getMonth(),
      todayMidnight.getDate() - i,
    );
    dayTs.push(d.getTime());
  }
  const startOffset = new Date(dayTs[0]!).getDay();
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (const ts of dayTs) cells.push(ts);
  return cells;
}

function key(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("drop calendar grid across DST", () => {
  it("includes every calendar day across a spring-forward boundary", () => {
    // America/New_York springs forward 2026-03-08.
    const now = new Date("2026-03-20T12:00:00-04:00").getTime();
    const cells = buildGridCells(30, now).filter(
      (c): c is number => c !== null,
    );
    const keys = cells.map(key);
    expect(keys).toHaveLength(30);
    expect(keys).toContain("2026-03-08");
    // Contiguous, no gaps.
    expect(new Set(keys).size).toBe(30);
  });
});
