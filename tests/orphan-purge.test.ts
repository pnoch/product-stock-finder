import { describe, expect, it, vi, beforeEach } from "vitest";

const deleteWhere = vi.fn(async () => ({ affectedRows: 1 }));
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

describe("orphan purge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteWhere.mockResolvedValue({ affectedRows: 1 });
  });

  it("issues a delete for insight rows outside the catalog", async () => {
    await purgeOrphanedInsights();
    expect(dbStub.delete).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("issues a delete for image rows outside the catalog", async () => {
    await purgeOrphanedImages();
    expect(dbStub.delete).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});
