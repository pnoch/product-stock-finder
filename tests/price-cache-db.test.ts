import { beforeEach, describe, expect, it } from "vitest";
import { priceCache } from "../drizzle/schema";
import { getDb } from "../server/db";
import {
  clearPriceCacheForTests,
  getAllFetchedAt,
  getCachedPrice,
  listNearExpiry,
  purgeStalePriceCache,
  setCachedPrice,
} from "../server/price-cache";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const DAY = 24 * 60 * 60 * 1000;

function snapshot(fetchedAt: number, price = 100) {
  return {
    price,
    currency: "USD",
    stockStatus: "in_stock" as const,
    url: "https://example.com",
    fetchedAt,
  };
}

describe.skipIf(!runDbTests)("price-cache (DB)", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(priceCache);
    clearPriceCacheForTests();
  });

  it("stores and reads a snapshot, upserting on repeat", async () => {
    const now = Date.now();
    await setCachedPrice("d1", "M1", snapshot(now, 100));
    await setCachedPrice("d1", "M1", snapshot(now, 120));
    const cached = await getCachedPrice("d1", "M1");
    expect(cached?.price).toBeCloseTo(120);
    expect(await getCachedPrice("d1", "missing")).toBeNull();
  });

  it("rejects an implausible price without writing", async () => {
    await expect(
      setCachedPrice("d1", "M1", snapshot(Date.now(), 0)),
    ).rejects.toThrow(/implausible/i);
    expect(await getCachedPrice("d1", "M1")).toBeNull();
  });

  it("lists near-expiry pairs and honors the limit", async () => {
    const now = Date.now();
    await setCachedPrice("stale", "M1", snapshot(now - 2 * DAY));
    await setCachedPrice("stale", "M2", snapshot(now - 2 * DAY));
    await setCachedPrice("fresh", "M3", snapshot(now));

    const near = await listNearExpiry(now, DAY);
    expect(near.map((e) => e.distributorId).sort()).toEqual(["stale", "stale"]);
    expect(await listNearExpiry(now, DAY, 1)).toHaveLength(1);
  });

  it("returns fetched-at rows newest first", async () => {
    const now = Date.now();
    await setCachedPrice("old", "M1", snapshot(now - 5 * DAY));
    await setCachedPrice("new", "M2", snapshot(now));
    const rows = await getAllFetchedAt();
    expect(rows.map((r) => r.distributorId)).toEqual(["new", "old"]);
  });

  it("purges rows past the 30-day retention, keeping fresh ones", async () => {
    const now = Date.now();
    await setCachedPrice("old", "M1", snapshot(now - 40 * DAY));
    await setCachedPrice("new", "M2", snapshot(now - DAY));

    await purgeStalePriceCache(now);

    expect(await getCachedPrice("old", "M1")).toBeNull();
    expect((await getCachedPrice("new", "M2"))?.price).toBeCloseTo(100);
  });
});
