import { describe, expect, it, vi } from "vitest";

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
