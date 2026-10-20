import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// "Re-enable" exists to clear a distributor's circuit breaker so the next
// fetch is attempted again. It must NOT stamp `lastChecked`: that field means
// "last successful check" (refresh-listing.ts only writes it on a successful
// parse), so stamping it fabricated a success the UI then reported as
// "OK / Last checked: today" with no prices fetched.
function handlerBlock(src: string): string {
  const start = src.indexOf("const handleReenableDistributor");
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("\n  }, [", start);
  return src.slice(start, end);
}

describe("distributor re-enable does not fabricate freshness", () => {
  it("mobile handler never stamps lastChecked or rewrites listings", () => {
    const src = readFileSync(
      join(process.cwd(), "..", "app/(tabs)/settings.tsx"),
      "utf8",
    );
    const block = handlerBlock(src);
    expect(block).toContain("clearDistributorBreaker(distributorId");
    expect(block).not.toContain("lastChecked: nowIso");
    expect(block).not.toContain("updateProductListings");
  });

  it("desktop handler never stamps lastChecked or rewrites listings", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/settings/scraper-status-section.tsx"),
      "utf8",
    );
    const block = handlerBlock(src);
    expect(block).toContain("clearDistributorBreaker(distributorId");
    expect(block).not.toContain("lastChecked: nowIso");
    expect(block).not.toContain("updateProductListings");
  });
});