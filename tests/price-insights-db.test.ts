import { beforeEach, describe, expect, it, vi } from "vitest";
import { priceCache, priceInsights } from "../drizzle/schema";
import { getDb } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const llm = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../server/user-llm", () => ({
  isServerFundedLlm: () => false,
  invokeUserLlm: vi.fn(async () => {
    llm.calls += 1;
    return { choices: [{ message: { content: "Buy now." } }] };
  }),
}));

import {
  clearInsightsForTests,
  getInsight,
  INSIGHT_TTL_MS,
  purgeOrphanedInsights,
} from "../server/price-insights";
import { clearPriceCacheForTests, setCachedPrice } from "../server/price-cache";
import { PRODUCT_CATALOG } from "../shared/src/catalog.js";

const PRODUCT = PRODUCT_CATALOG[0]!;

describe.skipIf(!runDbTests)("price-insights (DB)", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(priceInsights);
    await db.delete(priceCache);
    await clearInsightsForTests();
    clearPriceCacheForTests();
    llm.calls = 0;
  });

  async function seedPrice() {
    await setCachedPrice("server2u-my", PRODUCT.modelNumber, {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
  }

  it("generates, caches in the DB, and serves the cache next time", async () => {
    const db = await getDb();
    await seedPrice();

    const first = await getInsight(PRODUCT.id);
    expect(first?.insight).toBe("Buy now.");
    expect(llm.calls).toBe(1);

    const rows = await db!
      .select({ productId: priceInsights.productId })
      .from(priceInsights);
    expect(rows).toEqual([{ productId: PRODUCT.id }]);

    const second = await getInsight(PRODUCT.id);
    expect(second).toEqual(first);
    expect(llm.calls).toBe(1);
  });

  it("returns null when there is no price data to analyse", async () => {
    expect(await getInsight(PRODUCT.id)).toBeNull();
    expect(llm.calls).toBe(0);
  });

  it("clearInsightsForTests deletes the shared DB rows", async () => {
    await seedPrice();
    await getInsight(PRODUCT.id);
    await clearInsightsForTests();
    const rows = await (await getDb())!.select().from(priceInsights);
    expect(rows).toHaveLength(0);
  });

  it("purgeOrphanedInsights drops rows not in the catalog", async () => {
    const db = await getDb();
    await db!.insert(priceInsights).values([
      { productId: "orphan-xyz", insight: "x", generatedAt: Date.now() },
      { productId: PRODUCT.id, insight: "y", generatedAt: Date.now() },
    ]);
    await purgeOrphanedInsights();
    const ids = (await db!.select({ productId: priceInsights.productId }).from(priceInsights)).map(
      (r) => r.productId,
    );
    expect(ids).toEqual([PRODUCT.id]);
  });

  it("treats a stale row as a miss", async () => {
    const db = await getDb();
    await seedPrice();
    await db!.insert(priceInsights).values({
      productId: PRODUCT.id,
      insight: "old",
      generatedAt: Date.now() - INSIGHT_TTL_MS - 1000,
    });
    const fresh = await getInsight(PRODUCT.id);
    expect(fresh?.insight).toBe("Buy now.");
    expect(llm.calls).toBe(1);
  });
});
