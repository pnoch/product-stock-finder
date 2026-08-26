import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/constants/oauth", () => ({
  isServerConfigured: vi.fn(() => true),
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchProductImage } from "../lib/server-images";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockImagesGet(handler: () => Promise<{ imageUrl: string } | null>) {
  mockedCreateClient.mockReturnValue({
    images: { get: { query: handler } },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImagesGet(async () => ({
      imageUrl: "https://img.example.com/crs804.png",
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the product image URL", async () => {
    const result = await fetchProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
  });

  it("returns null when there is no image", async () => {
    mockImagesGet(async () => null);
    const result = await fetchProductImage("unknown");
    expect(result).toBeNull();
  });

  it("returns null when the client throws", async () => {
    mockImagesGet(async () => {
      throw new Error("network down");
    });
    const result = await fetchProductImage("a");
    expect(result).toBeNull();
  });

  it("returns null when the request times out", async () => {
    mockImagesGet(
      () =>
        new Promise<never>((_resolve) =>
          setTimeout(() => _resolve({} as never), 50),
        ),
    );
    const result = await fetchProductImage("a", { timeoutMs: 10 });
    expect(result).toBeNull();
  });
});
