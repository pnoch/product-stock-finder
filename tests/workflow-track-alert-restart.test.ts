import { describe, expect, it } from "vitest";
import { createStorage } from "../lib/storage";
import type { Product } from "../lib/types";

// Launch-critical workflow: search → preview → track → alert → restart.
// The pieces are component-tested elsewhere (discover-search-integration,
// use-live-prices, storage-alerts); this pins the storage round-trip the UI
// depends on: a product tracked from an untracked preview and its price alert
// must both survive a fresh storage instance reading the same adapter — what
// happens when the app process is killed and relaunched.
describe("track + alert survive a restart", () => {
  it("keeps a catalog product and its active alert across storage instances", async () => {
    const store = new Map<string, string>();
    const adapter = {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: async (k: string) => {
        store.delete(k);
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((k) => store.delete(k));
      },
    };

    const first = createStorage(adapter);
    const product: Product = {
      id: "mikrotik-crs518",
      name: "MikroTik CRS518-16XS-2XQ",
      modelNumber: "CRS518-16XS-2XQ",
      brand: "MikroTik",
      category: "Networking Switch",
      description: "Cloud Router Switch with 16x 25G SFP28 and 2x 100G QSFP28.",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    expect(await first.addToWatchlist(product)).toBe(true);
    await first.addAlert({
      id: "alert-crs518-900",
      productId: "mikrotik-crs518",
      targetPrice: 900,
      currency: "USD",
      isActive: true,
      direction: "drop",
      createdAt: new Date().toISOString(),
    });

    // A fresh instance over the same adapter is what a relaunched app sees.
    const restarted = createStorage(adapter);
    const watched = (await restarted.getWatchlist()).find(
      (p) => p.id === "mikrotik-crs518",
    );
    expect(watched).toMatchObject({
      id: product.id,
      isWatched: true,
      modelNumber: "CRS518-16XS-2XQ",
    });

    const alerts = await restarted.getAlerts();
    const alert = alerts.find((a) => a.id === "alert-crs518-900");
    expect(alerts).toHaveLength(1);
    expect(alert).toMatchObject({
      productId: product.id,
      isActive: true,
      targetPrice: 900,
      currency: "USD",
      direction: "drop",
    });
  });
});
