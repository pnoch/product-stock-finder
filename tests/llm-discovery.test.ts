import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock constants/oauth
vi.mock("../constants/oauth", () => ({
  getApiBaseUrl: vi.fn(() => "http://localhost:3000"),
  isServerConfigured: vi.fn(() => true),
}));

// In-memory AsyncStorage mock
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

import { discoverProduct } from "../lib/llm-discovery";

describe("discoverProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
  });

  it("returns product and retailers on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          data: {
            json: {
              product: {
                name: "Sony WH-1000XM5",
                modelNumber: "WH-1000XM5",
                brand: "Sony",
                category: "Headphones",
                description: "Noise-canceling headphones",
              },
              retailers: [
                {
                  name: "Amazon",
                  website: "https://amazon.com",
                  country: "US",
                  currency: "USD",
                },
              ],
            },
          },
        },
      }),
    });

    const result = await discoverProduct("Sony WH-1000XM5");
    expect(result).not.toBeNull();
    expect(result!.product.name).toBe("Sony WH-1000XM5");
    expect(result!.retailers).toHaveLength(1);
    expect(result!.retailers[0].name).toBe("Amazon");
  });

  it("throws typed DiscoveryError on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(discoverProduct("nonexistent")).rejects.toMatchObject({ name: "DiscoveryError", kind: "server" });
  });

  it("returns null on invalid JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => "not json",
    });
    const result = await discoverProduct("bad response");
    expect(result).toBeNull();
  });

  it("throws typed DiscoveryError when getApiBaseUrl returns empty string", async () => {
    const { getApiBaseUrl } = await import("../constants/oauth");
    vi.mocked(getApiBaseUrl).mockReturnValueOnce("");
    await expect(discoverProduct("test")).rejects.toMatchObject({ name: "DiscoveryError", kind: "server" });
  });
});
