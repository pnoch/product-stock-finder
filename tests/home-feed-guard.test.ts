import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("home feed wiring", () => {
  it("home uses feed helpers and cards", () => {
    const src = read("app/(tabs)/index.tsx");
    const feed = read("components/home/home-feed.tsx");
    expect(src).toContain("buildFeedItems");
    expect(feed).toContain("feed-card");
  });

  it("stat cards and old sections are gone", () => {
    const src = read("app/(tabs)/index.tsx");
    expect(src).not.toContain("TrendingSection");
    expect(src).not.toContain("AvailableSection");
    expect(src).not.toContain("AwaySummaryCard");
  });

  it("feed helpers exist", () => {
    const src = read("lib/home-feed.ts");
    expect(src).toContain("buildFeedItems");
    expect(src).toContain("greetingFor");
  });

  it("feed cards exist", () => {
    const src = read("components/home/feed-card.tsx");
    expect(src).toContain("AlertFiredCard");
    expect(src).toContain("QuietCard");
  });
});
