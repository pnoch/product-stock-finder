import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchParsedProduct } from "../lib/server-product-parse";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    products: {
      parse: {
        query: vi.fn(async ({ raw }: { raw: string }) => ({
          product: {
            name: `Parsed ${raw.slice(0, 10)}`,
            modelNumber: "M123",
            brand: "Test",
            category: "Switch",
            description: "Desc",
          },
        })),
      },
    },
  })),
}));

describe("fetchParsedProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns product on success", async () => {
    const p = await fetchParsedProduct("some raw text");
    expect(p?.name).toContain("Parsed");
  });

  it("slices raw to 2000 chars", async () => {
    const { createTRPCClient } = await import("../lib/trpc");
    const long = "a".repeat(3000);
    vi.mocked(createTRPCClient).mockReturnValueOnce({
      products: {
        parse: {
          query: vi.fn(async ({ raw }: { raw: string }) => {
            expect(raw.length).toBe(2000);
            return {
              product: {
                name: "x",
                modelNumber: "M123",
                brand: "Test",
                category: "Switch",
                description: "Desc",
              },
            };
          }),
        },
      },
    } as never);
    await fetchParsedProduct(long);
  });

  it("returns null on throw", async () => {
    const { createTRPCClient } = await import("../lib/trpc");
    vi.mocked(createTRPCClient).mockReturnValueOnce({
      products: {
        parse: { query: vi.fn(async () => { throw new Error("fail"); }) },
      },
    } as never);
    expect(await fetchParsedProduct("x")).toBeNull();
  });

  it("times out after 8s (returns null)", async () => {
    const { createTRPCClient } = await import("../lib/trpc");
    vi.mocked(createTRPCClient).mockReturnValueOnce({
      products: {
        parse: {
          query: vi.fn(() => new Promise(() => {})),
        },
      },
    } as never);
    // Use fake timers to avoid waiting 8s
    vi.useFakeTimers();
    const p = fetchParsedProduct("x");
    vi.advanceTimersByTime(8000);
    expect(await p).toBeNull();
    vi.useRealTimers();
  }, 10000);
});
