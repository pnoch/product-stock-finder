import { describe, expect, it, beforeEach, vi } from "vitest";

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

import { getPriceDigestSnapshot } from "../lib/storage";

describe("getPriceDigestSnapshot validation", () => {
  beforeEach(() => store.clear());

  it("returns a valid snapshot", async () => {
    const snapshot = {
      lastDigestAt: "2026-09-01T00:00:00.000Z",
      displayCurrency: "USD",
      products: [{ productId: "p1", name: "P", bestPrice: 10, stockStatus: "in_stock" }],
    };
    store.set("price_digest_snapshot", JSON.stringify(snapshot));
    expect(await getPriceDigestSnapshot()).toEqual(snapshot);
  });

  // A corrupt payload with `products` as a non-array would make computeDigest's
  // `.map` throw inside a useMemo (no error boundary), crashing the Stats tab.
  it("returns null when products is not an array", async () => {
    store.set("price_digest_snapshot", JSON.stringify({ lastDigestAt: "x", products: "oops" }));
    expect(await getPriceDigestSnapshot()).toBeNull();
  });

  it("returns null for a non-object payload", async () => {
    store.set("price_digest_snapshot", JSON.stringify("nope"));
    expect(await getPriceDigestSnapshot()).toBeNull();
  });
});
