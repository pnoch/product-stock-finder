import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

import { generateImage } from "../server/_core/imageGeneration";
import {
  getProductImage,
  listProductsMissingImage,
  clearImagesForTests,
} from "../server/product-images";

const mockedGenerateImage = vi.mocked(generateImage);

describe("getProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearImagesForTests();
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
  beforeEach(() => {
    vi.clearAllMocks();
    clearImagesForTests();
  });

  it("returns all catalog products when none have images", async () => {
    const missing = await listProductsMissingImage();
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).toContain("mikrotik-crs804-4ddq-hrm");
  });

  it("excludes products that already have an image", async () => {
    mockedGenerateImage.mockResolvedValue({ url: "https://img.example.com/x.png" });
    await getProductImage("mikrotik-crs804-4ddq-hrm");
    const missing = await listProductsMissingImage();
    expect(missing).not.toContain("mikrotik-crs804-4ddq-hrm");
  });
});
