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
  getDiscoveredDistributors,
  addDiscoveredDistributor,
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
  countryFlag: "🇺🇸",
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
});
