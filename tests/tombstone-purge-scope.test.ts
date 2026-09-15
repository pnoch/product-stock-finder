import { describe, expect, it, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const whereCalls: unknown[] = [];
const dbStub = {
  delete: vi.fn(() => ({
    where: vi.fn((cond: unknown) => {
      whereCalls.push(cond);
      return { limit: vi.fn(async () => undefined) };
    }),
  })),
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => dbStub),
}));

import { purgeOldTombstones } from "../server/sync-db";

const dialect = new MySqlDialect();

describe("purgeOldTombstones scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
  });

  it("purges all users (no userId column in the predicate)", async () => {
    await purgeOldTombstones(Date.now() - 1000);
    expect(dbStub.delete).toHaveBeenCalledTimes(4);
    // The predicate must not reference the userId column; a per-user purge left
    // every other account's tombstones to accumulate forever.
    for (const cond of whereCalls) {
      const { sql } = dialect.sqlToQuery(cond as never);
      expect(sql).not.toContain("userId");
    }
  });
});
