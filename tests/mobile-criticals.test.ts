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
