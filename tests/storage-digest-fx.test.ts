import { describe, expect, it } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import type { DigestSnapshot } from "../lib/price-digest";

function makeStorage(seed: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(seed));
  return createStorage({
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => {
      store.set(k, v);
    },
    removeItem: async (k) => {
      store.delete(k);
    },
    multiRemove: async (keys) => {
      keys.forEach((k) => store.delete(k));
    },
  });
}

const snapshot: DigestSnapshot = {
  lastDigestAt: "2026-01-01T00:00:00.000Z",
  displayCurrency: "USD",
  products: [
    { productId: "p1", name: "CRS804", bestPrice: 480, stockStatus: "in_stock" },
  ],
};

describe("price digest snapshot storage", () => {
  it("round-trips a saved snapshot", async () => {
    const storage = makeStorage();
    await storage.savePriceDigestSnapshot(snapshot);
    expect(await storage.getPriceDigestSnapshot()).toEqual(snapshot);
  });

  it("returns null when no snapshot is stored", async () => {
    expect(await makeStorage().getPriceDigestSnapshot()).toBeNull();
  });

  it("returns null for a snapshot whose products is not an array", async () => {
    const storage = makeStorage({
      price_digest_snapshot: JSON.stringify({ products: "oops" }),
    });
    expect(await storage.getPriceDigestSnapshot()).toBeNull();
  });

  it("returns null when the stored snapshot is corrupt JSON", async () => {
    const storage = makeStorage({ price_digest_snapshot: "{not json" });
    expect(await storage.getPriceDigestSnapshot()).toBeNull();
  });
});

describe("fx rates storage", () => {
  it("round-trips saved rates", async () => {
    const storage = makeStorage();
    await storage.saveFxRates({ rates: { EUR: 0.92, GBP: 0.8 }, fetchedAt: 1234 });
    expect(await storage.getFxRates()).toEqual({
      rates: { EUR: 0.92, GBP: 0.8 },
      fetchedAt: 1234,
    });
  });

  it("returns null when nothing is stored", async () => {
    expect(await makeStorage().getFxRates()).toBeNull();
  });

  it("drops non-finite rates and defaults a missing fetchedAt to 0", async () => {
    const storage = makeStorage({
      fx_rates: JSON.stringify({ rates: { EUR: 0.9, BAD: "x", NAN: null } }),
    });
    expect(await storage.getFxRates()).toEqual({
      rates: { EUR: 0.9 },
      fetchedAt: 0,
    });
  });

  it("returns null when no rate is usable", async () => {
    const storage = makeStorage({
      fx_rates: JSON.stringify({ rates: { BAD: "x" } }),
    });
    expect(await storage.getFxRates()).toBeNull();
  });

  it("returns null for corrupt JSON", async () => {
    const storage = makeStorage({ fx_rates: "not-json" });
    expect(await storage.getFxRates()).toBeNull();
  });
});
