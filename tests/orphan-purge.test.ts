import { describe, expect, it, vi, beforeEach } from "vitest";

const deleteWhere = vi.fn(async (_cond?: unknown) => ({ affectedRows: 1 }));
const dbStub = {
  delete: vi.fn(() => ({ where: deleteWhere })),
};

vi.mock("../server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/db")>();
  return { ...actual, getDb: vi.fn(async () => dbStub) };
});

vi.mock("../server/_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("../server/_core/imageGeneration", () => ({ generateImage: vi.fn() }));

import { purgeOrphanedInsights } from "../server/price-insights";
import { purgeOrphanedImages } from "../server/product-images";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const dialect = new MySqlDialect();

describe("orphan purge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteWhere.mockResolvedValue({ affectedRows: 1 });
  });

  it("deletes insight rows NOT IN the catalog", async () => {
    await purgeOrphanedInsights();
    expect(dbStub.delete).toHaveBeenCalledTimes(1);
    const { sql } = dialect.sqlToQuery(deleteWhere.mock.calls[0]![0] as never);
    // Must be a scoped NOT IN, not an unbounded delete.
    expect(sql).toContain("not in");
    expect(sql).toContain("productId");
  });

  it("deletes image rows NOT IN the catalog", async () => {
    await purgeOrphanedImages();
    expect(dbStub.delete).toHaveBeenCalledTimes(1);
    const { sql } = dialect.sqlToQuery(deleteWhere.mock.calls[0]![0] as never);
    expect(sql).toContain("not in");
    expect(sql).toContain("productId");
  });
});
