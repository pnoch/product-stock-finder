import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("redesign navigation wiring", () => {
  it("tab layout has five tabs: index, discover, watchlist, drops, alerts", () => {
    const src = read("app/(tabs)/_layout.tsx");
    for (const name of ['name="index"', 'name="discover"', 'name="watchlist"', 'name="drops"', 'name="alerts"']) {
      expect(src).toContain(name);
    }
  });

  it("rates and settings tabs are hidden but present", () => {
    const src = read("app/(tabs)/_layout.tsx");
    expect(src).toContain('name="rates"');
    expect(src).toContain('name="settings"');
    expect(src).toContain("href: null");
  });

  it("drops tab re-exports the drops screen", () => {
    expect(read("app/(tabs)/drops.tsx")).toContain("../drops");
  });

  it("discover screen composes search + trending + available", () => {
    // Plan 5.24: Discover now renders the shared SearchScreen (mode="discover")
    // and passes Trending/Available as browse content, so the catalog search
    // engine, Facebook results, and marketplace sheet all share one query.
    const src = read("app/(tabs)/discover.tsx");
    expect(src).toContain('SearchScreen mode="discover"');
    expect(src).toContain("TrendingSection");
    expect(src).toContain("AvailableSection");
  });

  it("you screen links to stats, rates, health, diagnostics, settings", () => {
    const src = read("app/you.tsx");
    for (const href of ["/stats", "/health", "/diagnostics", "/(tabs)/settings"]) {
      expect(src).toContain(href);
    }
    expect(src).toContain("rates");
  });

  it("home links to you screen", () => {
    expect(read("app/(tabs)/index.tsx")).toContain("/you");
  });
});
