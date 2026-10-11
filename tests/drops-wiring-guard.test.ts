import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("drops feature wiring", () => {
  it("Home screen imports DropLeaderboard", () => {
    expect(read("app/(tabs)/index.tsx")).toContain("drop-leaderboard");
  });

  it("full screen route exists and exports", () => {
    const src = read("app/drops.tsx");
    expect(src).toContain("Price Drops");
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
