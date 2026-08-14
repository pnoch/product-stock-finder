import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/product-images", () => ({
  getProductImage: vi.fn(),
  listProductsMissingImage: vi.fn(),
  clearImagesForTests: vi.fn(),
}));

import { getProductImage } from "../server/product-images";
const mockedGetProductImage = vi.mocked(getProductImage);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
  };
}

describe("images router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the product image URL", async () => {
    mockedGetProductImage.mockResolvedValue({
      imageUrl: "https://img.example.com/crs804.png",
    });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.images.get({
      productId: "mikrotik-crs804-4ddq-hrm",
    });
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGetProductImage).toHaveBeenCalledWith(
      "mikrotik-crs804-4ddq-hrm",
    );
  });

  it("returns null when there is no image", async () => {
    mockedGetProductImage.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.images.get({ productId: "unknown" });
    expect(result).toBeNull();
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetProductImage.mockResolvedValue({ imageUrl: "x" });
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.images.get({ productId: "a" })).resolves.toEqual({
      imageUrl: "x",
    });
  });
});
