import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// The acquired-state feature is only correct if every consumer actually filters
// through `activeProducts`/`isAcquired`. A pure-function test can't catch a
// screen that forgot to wire the filter, so pin the call sites here.
describe("acquired consumers are wired", () => {
  it("the build-order, sourcing, stats, and home screens filter to active products", () => {
    for (const file of [
      "app/build-order.tsx",
      "app/sourcing.tsx",
      "app/stats.tsx",
      "app/(tabs)/index.tsx",
    ]) {
      expect(read(file), `${file} must call activeProducts`).toContain("activeProducts");
    }
  });

  it("the alert and restock paths skip acquired products", () => {
    expect(read("lib/background-tasks/price-check.ts")).toContain("isAcquired(product)");
    expect(read("lib/restock.ts")).toContain("isAcquired(product)");
  });

  it("the digest and basket paths compute over active products", () => {
    const priceCheck = read("lib/background-tasks/price-check.ts");
    expect(priceCheck).toContain("activeProducts(await getWatchlist())");
  });

  it("the server upload excludes acquired products", () => {
    expect(read("lib/server-notifications.ts")).toContain("isAcquired");
  });
});
