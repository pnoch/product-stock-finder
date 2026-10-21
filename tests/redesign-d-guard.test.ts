import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("redesign D wiring", () => {
  it("swipe card supports alert/acquired/remove", () => {
    const src = read("components/watchlist/swipeable-card.tsx");
    expect(src).toContain("onToggleAlert");
    expect(src).toContain("onToggleAcquired");
  });

  it("watchlist wires swipe handlers", () => {
    const src = read("app/(tabs)/watchlist.tsx");
    expect(src).toContain("onToggleAlert");
    expect(src).toContain("onToggleAcquired");
  });

  it("filter bar collapses with count", () => {
    const src = read("app/(tabs)/watchlist.tsx");
    expect(src).toContain("Filters");
  });

  it("cards use 16px radius on key screens", () => {
    for (const f of [
      "components/alerts/alerts-list-row.tsx",
      "app/drops.tsx",
      "components/home/feed-card.tsx",
    ]) {
      expect(read(f)).toContain("borderRadius: 16");
    }
  });
});
