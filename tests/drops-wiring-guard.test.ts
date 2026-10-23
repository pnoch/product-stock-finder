import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("drops feature wiring", () => {
  it("Home screen surfaces drops via the feed", () => {
    // Redesign Plan C dissolved the DropLeaderboard section into the priority
    // feed; drops still reach Home through DropCard + computeLocalDrops.
    expect(read("components/home/home-feed.tsx")).toContain("DropCard");
  });

  it("full screen route exists and exports", () => {
    const src = read("app/drops.tsx");
    const header = read("components/drops/drops-header.tsx");
    expect(src).toContain("DropsScreen");
    expect(header).toContain("Price Drops");
  });

  it("computeLocalDrops is defined", () => {
    expect(read("lib/price-leaderboard.ts")).toContain("export function computeLocalDrops");
  });

  it("buildDropShareText is defined", () => {
    expect(read("lib/price-leaderboard.ts")).toContain("export function buildDropShareText");
  });

  it("server has topDrops query", () => {
    expect(read("server/routers/prices.ts")).toContain("topDrops");
  });

  it("home section component exists", () => {
    expect(read("components/home/drop-leaderboard.tsx")).toContain("DropLeaderboard");
  });
});
