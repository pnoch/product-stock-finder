import { describe, expect, it, beforeEach } from "vitest";
import { priceHistory } from "../drizzle/schema";
import { getDb } from "../server/db";
import {
  getHistory,
  mergeHistory,
  purgeOldHistory,
} from "../server/price-history";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

function point(date: string, price: number) {
  return { date, price, currency: "USD", stockStatus: "in_stock" as const };
}

describe.skipIf(!runDbTests)("price-history (DB)", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(priceHistory);
  });

  it("records history, reads it back, and keeps the newest same-day point", async () => {
    const day = "2026-01-05";
    await mergeHistory("d1", "M1", [point(`${day}T01:00:00.000Z`, 100)]);
    await mergeHistory("d1", "M1", [point(`${day}T02:00:00.000Z`, 90)]);

    let rows = await getHistory("d1", "M1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.price).toBeCloseTo(90);

    // An older point for the same day must not overwrite the newer one.
    await mergeHistory("d1", "M1", [point(`${day}T00:30:00.000Z`, 80)]);
    rows = await getHistory("d1", "M1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.price).toBeCloseTo(90);

    // A newer point does replace it.
    await mergeHistory("d1", "M1", [point(`${day}T03:00:00.000Z`, 70)]);
    rows = await getHistory("d1", "M1");
    expect(rows[0]!.price).toBeCloseTo(70);
  });

  it("keeps history for distinct days", async () => {
    await mergeHistory("d1", "M1", [
      point("2026-01-05T01:00:00.000Z", 100),
      point("2026-01-06T01:00:00.000Z", 95),
    ]);
    const rows = await getHistory("d1", "M1");
    expect(rows.map((r) => r.price)).toEqual([100, 95]);
  });

  it("ignores an empty merge", async () => {
    await mergeHistory("d3", "M3", []);
    expect(await getHistory("d3", "M3")).toEqual([]);
  });

  it("purges points older than the 90-day window", async () => {
    const now = Date.parse("2026-06-15T12:00:00.000Z");
    const old = new Date(now);
    old.setUTCDate(old.getUTCDate() - 100);
    const recent = new Date(now);
    recent.setUTCDate(recent.getUTCDate() - 1);

    await mergeHistory("d2", "M2", [
      point(old.toISOString(), 10),
      point(recent.toISOString(), 20),
    ]);
    expect(await getHistory("d2", "M2")).toHaveLength(2);

    await purgeOldHistory(now);
    const kept = await getHistory("d2", "M2");
    expect(kept).toHaveLength(1);
    expect(kept[0]!.price).toBeCloseTo(20);
  });
});
