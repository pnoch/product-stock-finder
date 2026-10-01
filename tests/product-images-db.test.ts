import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { productImages } from "../drizzle/schema";
import { getDb } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const generateImage = vi.hoisted(() => vi.fn());
vi.mock("../server/_core/imageGeneration", () => ({ generateImage }));
vi.mock("../server/spend-budget", () => ({ tryConsumeBudget: () => true }));

import {
  clearImagesForTests,
  getProductImage,
  listProductsMissingImage,
  purgeOrphanedImages,
} from "../server/product-images";

const CATALOG_ID = "mikrotik-crs804-4ddq-hrm";

describe.skipIf(!runDbTests)("product-images (DB)", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(productImages);
    await clearImagesForTests();
    generateImage.mockReset();
    generateImage.mockResolvedValue({ url: "https://img.example.com/x.png" });
  });

  it("generates once, caches in the DB, and serves the cache next time", async () => {
    expect(await getProductImage(CATALOG_ID)).toEqual({
      imageUrl: "https://img.example.com/x.png",
    });
    expect(generateImage).toHaveBeenCalledTimes(1);

    const db = await getDb();
    const rows = await db!
      .select({ imageUrl: productImages.imageUrl })
      .from(productImages)
      .where(eq(productImages.productId, CATALOG_ID));
    expect(rows).toHaveLength(1);

    expect(await getProductImage(CATALOG_ID)).toEqual({
      imageUrl: "https://img.example.com/x.png",
    });
    expect(generateImage).toHaveBeenCalledTimes(1);
  });

  it("returns null for an unknown product", async () => {
    expect(await getProductImage("not-a-product")).toBeNull();
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("listProductsMissingImage excludes cached ids", async () => {
    const all = await listProductsMissingImage();
    expect(all).toContain(CATALOG_ID);

    await getProductImage(CATALOG_ID);
    const remaining = await listProductsMissingImage();
    expect(remaining).not.toContain(CATALOG_ID);
    expect(remaining).toHaveLength(all.length - 1);
  });

  it("clearImagesForTests deletes the shared DB rows", async () => {
    await getProductImage(CATALOG_ID);
    await clearImagesForTests();
    expect(await listProductsMissingImage()).toContain(CATALOG_ID);
  });

  it("purgeOrphanedImages drops rows not in the catalog", async () => {
    const db = await getDb();
    await db!.insert(productImages).values([
      { productId: "orphan-xyz", imageUrl: "https://img.example.com/o.png" },
      { productId: CATALOG_ID, imageUrl: "https://img.example.com/k.png" },
    ]);

    await purgeOrphanedImages();

    const ids = (
      await db!.select({ productId: productImages.productId }).from(productImages)
    ).map((r) => r.productId);
    expect(ids).toEqual([CATALOG_ID]);
  });
});
