import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

describe("mobile release blockers", () => {
  it("has exactly one shared-watchlist route", () => {
    const candidates = ["app/w/[token].tsx", "app/(tabs)/w/[token].tsx"].filter((file) =>
      existsSync(path.join(process.cwd(), file)),
    );
    expect(candidates).toHaveLength(1);
  });

  // The server's NOT_FOUND message is literally "Share not found", so rendering
  // `query.error.message` under a "Share not found" heading printed the same
  // sentence twice (verified on device). The screen must substitute an
  // actionable subtitle when the message just repeats the title.
  it("does not repeat the share-not-found heading as its own subtitle", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).not.toMatch(/\{query\.error\.message\}/);
    expect(src).toContain("This link may have expired, been revoked, or never existed.");
  });

  // QA round 18: "Add all to Watchlist" counted every non-throwing
  // addToWatchlist call as an add, but the storage layer silently no-ops on a
  // duplicate. Tapping it twice on an already-imported share reported "Added 2
  // products" while the watchlist stayed at 14 (verified on device). The screen
  // must branch on the boolean return and surface the duplicate count.
  it("counts only real inserts when adding a shared watchlist", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).toMatch(/if \(await addToWatchlist\(/);
    expect(src).toContain("duplicates");
    expect(src).toContain("already tracked");
  });

  // The server caps the public share payload at 500 products and returns
  // `truncated: true`; the client ignored it, so a >500-product share looked
  // like a complete (but short) watchlist. Surface the cap.
  it("surfaces the server's 500-product truncation flag", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).toContain("truncated");
    expect(src).toContain("first 500");
  });

  // QA round 21: the shared-watchlist header hardcoded "products", so a
  // single-product share rendered "1 products" (verified on web). Pluralize.
  it("pluralizes the shared-watchlist product count", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).toMatch(/product\{products\.length === 1 \? "" : "s"\}/);
  });
});

// QA round 16: the search screen rendered its filter chrome (tag chips,
// category/brand pill rows, sort bar) as fixed flex siblings above the results
// FlatList. On a 1080x2400 device those rows consumed ~2076px, squeezing the
// list into a ~324px strip at the bottom — the empty state and every result
// past the first card were clipped below the fold (verified on device: "25
// RESULTS" showed only a sliver of the first card). The chrome must live in the
// list's ListHeaderComponent so it scrolls away with the content, exactly like
// the watchlist screen's QA-round-8 fix.
describe("search results list owns the filter chrome", () => {
  const src = readFileSync(path.join(process.cwd(), "app/search.tsx"), "utf8");

  it("gives the results FlatList flex:1", () => {
    const listStart = src.indexOf("<FlatList");
    expect(listStart).toBeGreaterThan(-1);
    const openingTag = src.slice(listStart, listStart + 400);
    expect(openingTag).toMatch(/style=\{\{\s*flex:\s*1\s*\}\}/);
  });

  it("renders the filter chrome inside ListHeaderComponent", () => {
    const listStart = src.indexOf("<FlatList");
    const headerStart = src.indexOf("ListHeaderComponent=");
    const headerEnd = src.indexOf("ListEmptyComponent=");
    expect(listStart).toBeGreaterThan(-1);
    expect(headerStart).toBeGreaterThan(listStart);
    expect(headerEnd).toBeGreaterThan(headerStart);
    const header = src.slice(headerStart, headerEnd);
    expect(header).toContain("TagFilterRow");
    expect(header).toContain("PillFilterRow");
    expect(header).toContain("RecentSearches");
  });

  it("does not render filter chrome as fixed siblings before the FlatList", () => {
    const listStart = src.indexOf("<FlatList");
    const before = src.slice(0, listStart);
    expect(before).not.toContain("<TagFilterRow");
    expect(before).not.toContain("<PillFilterRow");
    expect(before).not.toContain("<RecentSearches");
  });
});

// QA round 17: the 2026-08-28 "product detail orchestration" refactor was meant
// to be a pure extraction (its spec says "[id].tsx (unchanged)" and "no logic
// changes"), but it dropped three render sites while still barrel-exporting the
// components. Private notes (Phase 90) and the distributor targets table
// (Phase 93) silently vanished from mobile while desktop kept both. These
// guards pin the render sites so a future refactor can't drop them again.
describe("product detail keeps its notes and distributor targets", () => {
  const src = readFileSync(path.join(process.cwd(), "app/product/[id].tsx"), "utf8");

  it("renders NotesCard", () => {
    expect(src).toMatch(/<NotesCard\b/);
  });

  it("renders TargetTableCard wired to the scoped-alert flow", () => {
    expect(src).toMatch(/<TargetTableCard\b/);
    expect(src).toContain("onSetTarget={handleSetTarget}");
    expect(src).toMatch(/<PriceAlertModal\b/);
  });

  it("keeps the notes and targets out of the share-image capture", () => {
    const shareStart = src.indexOf("ref={shareRef}");
    const shareEnd = src.indexOf("</View>", src.indexOf("<DistributorListingSection", shareStart));
    expect(shareStart).toBeGreaterThan(-1);
    expect(shareEnd).toBeGreaterThan(shareStart);
    const captured = src.slice(shareStart, shareEnd);
    expect(captured).not.toContain("<NotesCard");
    expect(captured).not.toContain("<TargetTableCard");
  });
});

// The per-distributor price-history modal owned CSV export until the same
// refactor dropped it. Compare is now the chart surface, so the export moved
// there; the modal is deleted rather than left as unreachable dead code.
describe("price-history CSV export lives on the Compare screen", () => {
  const compare = readFileSync(path.join(process.cwd(), "app/compare/[id].tsx"), "utf8");

  it("exports price history via the shared csv helper", () => {
    expect(compare).toContain("priceHistoryToCsv");
    expect(compare).toContain("exportCsvFile");
    expect(compare).toMatch(/accessibilityLabel="Export price history as CSV"/);
  });

  it("no longer ships the unreachable PriceChartModal", () => {
    expect(() =>
      readFileSync(path.join(process.cwd(), "components/product/price-chart-modal.tsx"), "utf8"),
    ).toThrow();
    const barrel = readFileSync(path.join(process.cwd(), "app/product/_components.tsx"), "utf8");
    expect(barrel).not.toContain("PriceChartModal");
  });

  // The modal was the mobile PriceHistoryChart's only consumer; deleting the
  // modal orphaned the chart too. Compare's MultiLineChart is the mobile chart
  // surface now, so the single-series chart is unreachable dead source (Metro
  // tree-shakes it from the bundle, but it should not linger in the repo).
  it("no longer keeps the orphaned single-series PriceHistoryChart", () => {
    expect(() =>
      readFileSync(path.join(process.cwd(), "components/price-history-chart.tsx"), "utf8"),
    ).toThrow();
  });
});

// QA round 22: a sweep of the remaining count labels that hardcoded the plural
// (Stock Health "N listings", health drill-down "N samples", sparkline a11y
// "N points", bulk-import a11y "N products"). Each can render with a count of 1.
describe("count labels pluralize", () => {
  const cases: Array<[string, RegExp]> = [
    ["components/stats/stock-health-card.tsx", /listing\{health\.totalListings === 1 \? "" : "s"\}/],
    ["app/health/[id].tsx", /sample\{summary\.count === 1 \? "" : "s"\}/],
    ["app/health/[id].tsx", /sample\{g\.samples\.length === 1 \? "" : "s"\}/],
    ["components/price-sparkline.tsx", /point\$\{data\.length === 1 \? "" : "s"\}/],
    ["components/search/bulk-import-modal.tsx", /product\$\{newProducts\.length === 1 \? "" : "s"\}/],
  ];
  for (const [file, pattern] of cases) {
    it(`${file} pluralizes`, () => {
      expect(readFileSync(path.join(process.cwd(), file), "utf8")).toMatch(pattern);
    });
  }
});
