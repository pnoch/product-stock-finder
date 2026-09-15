import { describe, expect, it, vi, beforeEach } from "vitest";

const whereCalls: unknown[] = [];
const dbStub = {
  delete: vi.fn(() => ({
    where: vi.fn((cond: unknown) => {
      whereCalls.push(cond);
      return { limit: vi.fn(async () => ({ affectedRows: 0 })) };
    }),
  })),
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => dbStub),
}));

import { purgeStalePriceCache } from "../server/price-cache";
import { purgeOldRevokedDevices } from "../server/devices";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const dialect = new MySqlDialect();

describe("retention purges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
  });

  it("purges price_cache rows older than the retention window", async () => {
    await purgeStalePriceCache(Date.now());
    expect(dbStub.delete).toHaveBeenCalledTimes(1);
    const { sql } = dialect.sqlToQuery(whereCalls[0] as never);
    expect(sql).toContain("fetchedAt");
  });

  it("purges revoked_devices rows older than the retention window", async () => {
    await purgeOldRevokedDevices(Date.now());
    expect(dbStub.delete).toHaveBeenCalledTimes(1);
    const { sql } = dialect.sqlToQuery(whereCalls[0] as never);
    expect(sql).toContain("revokedAt");
  });
});
