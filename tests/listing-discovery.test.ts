import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import {
  customProductSlug,
  discoverListings,
} from "../lib/listing-discovery";
import type { ServerPriceResult } from "../lib/types";

const NOW = 1_750_000_000_000;

function snapshotResult(
  overrides: Record<string, unknown> = {},
): ServerPriceResult {
  return {
    snapshot: {
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com/p",
      fetchedAt: NOW,
      ...overrides,
    },
    history: [],
  } as ServerPriceResult;
}

describe("customProductSlug", () => {
  it("normalizes model numbers into ids", () => {
    expect(customProductSlug("CRS326-24S+2Q+RM")).toBe(
      "custom-crs326-24s-2q-rm",
    );
    expect(customProductSlug("  hAP  ax²  ")).toBe("custom-hap-ax");
  });
});

describe("discoverListings", () => {
  it("maps snapshots to listings and skips misses", async () => {
    const fetchPrice = vi.fn(async (distributorId: string) =>
      distributorId === "hit-a" || distributorId === "hit-b"
        ? snapshotResult({ price: distributorId === "hit-a" ? 90 : 110 })
        : null,
    );
    const listings = await discoverListings("MODEL", {
      parserIds: ["miss-1", "hit-a", "miss-2", "hit-b"],
      fetchPrice,
      now: NOW,
    });
    expect(listings).toHaveLength(2);
    expect(listings.map((l) => l.distributorId).sort()).toEqual([
      "hit-a",
      "hit-b",
    ]);
    expect(listings[0].priceHistory).toHaveLength(1);
    expect(listings[0].priceHistory[0].price).toBeGreaterThan(0);
    expect(listings[0].lastChecked).toBe(new Date(NOW).toISOString());
  });

  it("reports progress with done/total", async () => {
    const onProgress = vi.fn();
    const fetchPrice = vi.fn(async () => null);
    await discoverListings("MODEL", {
      parserIds: ["a", "b", "c"],
      fetchPrice,
      now: NOW,
      onProgress,
    });
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  it("swallows fetch errors per distributor", async () => {
    const fetchPrice = vi.fn(async (d: string) => {
      if (d === "boom") throw new Error("network");
      return snapshotResult();
    });
    const listings = await discoverListings("MODEL", {
      parserIds: ["boom", "ok"],
      fetchPrice,
      now: NOW,
    });
    expect(listings.map((l) => l.distributorId)).toEqual(["ok"]);
  });
});
