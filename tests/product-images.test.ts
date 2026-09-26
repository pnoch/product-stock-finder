import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../server/_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

import { generateImage } from "../server/_core/imageGeneration";
import { getDb } from "../server/db";
import {
  getProductImage,
  listProductsMissingImage,
  clearImagesForTests,
} from "../server/product-images";

const mockedGenerateImage = vi.mocked(generateImage);
const mockedGetDb = vi.mocked(getDb);

describe("getProductImage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearImagesForTests();
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/crs804.png",
    });
  });

  it("generates and caches an image on first call", async () => {
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("returns the cached image on a second call without regenerating", async () => {
    await getProductImage("mikrotik-crs804-4ddq-hrm");
    const second = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(second).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests for the same product", async () => {
    const [first, second] = await Promise.all([
      getProductImage("mikrotik-crs804-4ddq-hrm"),
      getProductImage("mikrotik-crs804-4ddq-hrm"),
    ]);
    expect(first).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(second).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("returns null when the product is not in the catalog", async () => {
    const result = await getProductImage("unknown-product");
    expect(result).toBeNull();
    expect(mockedGenerateImage).not.toHaveBeenCalled();
  });

  it("returns null when generation fails", async () => {
    mockedGenerateImage.mockRejectedValue(new Error("gen failed"));
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toBeNull();
  });
});

describe("listProductsMissingImage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearImagesForTests();
  });

  it("returns all catalog products when none have images", async () => {
    const missing = await listProductsMissingImage();
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).toContain("mikrotik-crs804-4ddq-hrm");
  });

  it("excludes products that already have an image", async () => {
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/x.png",
    });
    await getProductImage("mikrotik-crs804-4ddq-hrm");
    const missing = await listProductsMissingImage();
    expect(missing).not.toContain("mikrotik-crs804-4ddq-hrm");
  });
});

describe("getProductImage DB resilience", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearImagesForTests();
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/crs804.png",
    });
    mockedGetDb.mockResolvedValue(null as never);
  });

  afterEach(() => {
    mockedGetDb.mockReset();
  });

  it("falls back to the memory cache when a DB read fails", async () => {
    const first = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(first).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    mockedGetDb.mockResolvedValue({
      select: () => {
        throw new Error("db down");
      },
    } as never);
    const second = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(second).toEqual(first);
  });

  it("keeps a freshly generated image when the DB write fails", async () => {
    mockedGetDb.mockResolvedValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
      insert: () => ({
        values: () => ({
          onDuplicateKeyUpdate: async () => {
            throw new Error("db down");
          },
        }),
      }),
    } as never);
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
  });
});
