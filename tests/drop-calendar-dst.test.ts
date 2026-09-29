import { describe, expect, it, vi } from "vitest";

// Pin a DST-observing zone: in a no-DST zone (UTC, Asia/Bangkok) the buggy
// fixed-24h algorithm and the calendar-date one agree, making the test vacuous.
process.env.TZ = "America/New_York";

// The component imports react-native (unparseable by Rollup under vitest); the
// grid builder under test is pure, so stub the RN surface it transitively pulls.
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Text: () => null,
  View: () => null,
  TouchableOpacity: () => null,
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({}) }));

import { buildGridCells } from "../components/stats/drop-calendar-card";
import { buildDayKeys } from "../lib/drop-calendar";

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

  // QA round 122: desktop built the drop-calendar day keys with fixed 24h steps
  // (`now - i * DAY_MS`), so a near-midnight anchor skipped the 23h
  // spring-forward day and its drops vanished. The shared helper uses
  // calendar-date arithmetic.
  it("buildDayKeys never skips a calendar day across spring-forward", () => {
    const now = new Date("2026-03-20T00:30:00-04:00").getTime();
    const keys = buildDayKeys(30, now);
    expect(keys).toHaveLength(30);
    expect(new Set(keys).size).toBe(30);
    expect(keys).toContain("2026-03-08");
    // The loop runs `i >= 0`, so the grid ends on today (i=0). A `> 0` bound
    // would drop today's cell.
    expect(keys[keys.length - 1]).toBe("2026-03-20");
    expect(keys[0]).toBe("2026-02-19");
  });
});
