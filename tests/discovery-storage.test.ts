import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Product, Distributor } from "../lib/types";

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

import {
  getDiscoveredProducts,
  addDiscoveredProduct,
  saveDiscoveredProducts,
  getDiscoveredDistributors,
  addDiscoveredDistributor,
  saveDiscoveredDistributors,
  saveBackgroundTaskInterval,
  getBackgroundTaskInterval,
} from "../lib/storage";

const mockProduct: Product = {
  id: "test-product-1",
  name: "Test Product",
  modelNumber: "TP-001",
  brand: "TestBrand",
  category: "Electronics",
  description: "A test product",
  addedAt: new Date().toISOString(),
  isWatched: true,
  listings: [],
};

const mockDistributor: Distributor = {
  id: "test-distributor-1",
  name: "TestStore",
  website: "https://teststore.com",
  country: "US",
  currency: "USD",
  region: "North America",
  countryCode: "US",
  paymentMethods: ["Credit Card"],
  shippingCosts: { "North America": 5 },
};

beforeEach(() => {
  store.clear();
});

describe("discovery storage", () => {
  it("starts with empty discovered products", async () => {
    const products = await getDiscoveredProducts();
    expect(products).toEqual([]);
  });

  it("adds and retrieves discovered product", async () => {
    await addDiscoveredProduct(mockProduct);
    const products = await getDiscoveredProducts();
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe("test-product-1");
  });

  it("deduplicates the same product discovered under a new time-based id", async () => {
    // The server mints `discovered-<ms>`, so a second discovery of the same
    // product has a different id — deduping on it appended duplicates and could
    // evict distinct entries at the cap.
    await addDiscoveredProduct(mockProduct);
    await addDiscoveredProduct({
      ...mockProduct,
      id: "discovered-999999",
    });
    const products = await getDiscoveredProducts();
    expect(products).toHaveLength(1);
    // The original id is kept so existing links keep working.
    expect(products[0]!.id).toBe("test-product-1");
  });

  it("returns the canonical product so a re-discovery dedups on add", async () => {
    // The caller adds the returned product to the watchlist, which dedups by
    // id. Returning the fresh time-based id made a re-discovery add a SECOND
    // watchlist entry for a product already tracked.
    const first = await addDiscoveredProduct(mockProduct);
    const second = await addDiscoveredProduct({
      ...mockProduct,
      id: "discovered-999999",
    });
    expect(first.id).toBe("test-product-1");
    expect(second.id).toBe("test-product-1");
  });

  it("deduplicates by product id", async () => {
    await addDiscoveredProduct(mockProduct);
    await addDiscoveredProduct(mockProduct);
    const products = await getDiscoveredProducts();
    expect(products).toHaveLength(1);
  });

  it("adds and retrieves discovered distributor", async () => {
    await addDiscoveredDistributor(mockDistributor);
    const distributors = await getDiscoveredDistributors();
    expect(distributors).toHaveLength(1);
    expect(distributors[0].id).toBe("test-distributor-1");
  });

  it("deduplicates by distributor id", async () => {
    await addDiscoveredDistributor(mockDistributor);
    await addDiscoveredDistributor(mockDistributor);
    const distributors = await getDiscoveredDistributors();
    expect(distributors).toHaveLength(1);
  });

  it("overwrites the discovered products list", async () => {
    await saveDiscoveredProducts([
      { ...mockProduct, id: "a" },
      { ...mockProduct, id: "b" },
    ]);
    expect((await getDiscoveredProducts()).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("appends products without a model instead of cross-deduping", async () => {
    const noModel = { ...mockProduct, modelNumber: "", brand: "X" };
    await addDiscoveredProduct({ ...noModel, id: "n1" });
    await addDiscoveredProduct({ ...noModel, id: "n2" });
    expect((await getDiscoveredProducts()).map((p) => p.id)).toEqual([
      "n1",
      "n2",
    ]);
  });

  it("overwrites the discovered distributors list", async () => {
    await saveDiscoveredDistributors([
      mockDistributor,
      { ...mockDistributor, id: "d2" },
    ]);
    expect((await getDiscoveredDistributors()).map((d) => d.id)).toEqual([
      "test-distributor-1",
      "d2",
    ]);
  });

  it("caps discovered distributors at 200, keeping the newest", async () => {
    for (let i = 0; i < 201; i++) {
      await addDiscoveredDistributor({ ...mockDistributor, id: `d${i}` });
    }
    const distributors = await getDiscoveredDistributors();
    expect(distributors).toHaveLength(200);
    expect(distributors[0]!.id).toBe("d1");
    expect(distributors.at(-1)!.id).toBe("d200");
  });
});

describe("background task interval markers", () => {
  it("keeps both markers when two tasks save concurrently", async () => {
    // The two launch registrations run unawaited; an unserialized
    // read-modify-write made the second overwrite the first, so that task
    // re-registered on every launch (resetting the OS scheduling window).
    await Promise.all([
      saveBackgroundTaskInterval(60, "price-drop-check"),
      saveBackgroundTaskInterval(60, "health-probe"),
    ]);
    expect(await getBackgroundTaskInterval("price-drop-check")).toBe(60);
    expect(await getBackgroundTaskInterval("health-probe")).toBe(60);
  });

  it("returns null for corrupt interval data", async () => {
    store.set("background_task_interval", "not-json");
    expect(await getBackgroundTaskInterval("price-drop-check")).toBeNull();
  });

  it("drops a marker when saved as null and removes the emptied key", async () => {
    await saveBackgroundTaskInterval(60, "price-drop-check");
    await saveBackgroundTaskInterval(null, "price-drop-check");
    expect(await getBackgroundTaskInterval("price-drop-check")).toBeNull();
    expect(store.has("background_task_interval")).toBe(false);
  });
});
