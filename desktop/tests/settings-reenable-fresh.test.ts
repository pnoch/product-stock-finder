import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// updateProductListings replaces the whole listings array, so rebuilding it
// from the mount-time `products` snapshot reverted every price/status/history
// change recorded since Settings opened (silent data loss). The handler must
// read the current watchlist first — as the mobile screen does.
describe("distributor re-enable reads fresh data", () => {
  it("does not rebuild listings from the mount-time snapshot", () => {
    const src = readFileSync(
      join(process.cwd(), "src/pages/Settings.tsx"),
      "utf8",
    );
    const start = src.indexOf("const handleReenableDistributor");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("}, [reenabling]);", start));
    expect(block).toContain("const fresh = await storage.getWatchlist()");
    expect(block).not.toContain("products\n        .filter");
  });
});
