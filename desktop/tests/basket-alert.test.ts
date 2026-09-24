import { describe, it, expect, vi } from "vitest";
import { evaluateBasketAlert, type BasketAlertSettings } from "../src/lib/basket-alert";
import type { Product } from "../../lib/types";

function product(price: number): Product {
  return {
    id: "a",
    name: "A",
    modelNumber: "A",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [
      {
        distributorId: "d1",
        productId: "a",
        price,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com/a",
        lastChecked: "2026-01-01T00:00:00.000Z",
        priceHistory: [],
      },
    ],
  };
}

function makeStorage(settings: BasketAlertSettings, watchlist: Product[] = [product(60)]) {
  const updateSettings = vi.fn().mockResolvedValue(undefined);
  return {
    storage: {
      getSettings: vi.fn().mockResolvedValue(settings),
      getWatchlist: vi.fn().mockResolvedValue(watchlist),
      updateSettings,
    },
    updateSettings,
  };
}

describe("evaluateBasketAlert", () => {
  it("fires and clears the threshold when the total is at or below it", async () => {
    const { storage, updateSettings } = makeStorage({
      notificationsEnabled: true,
      basketAlertThreshold: 100,
      displayCurrency: "USD",
    });
    const notify = vi.fn().mockResolvedValue(true);
    await expect(evaluateBasketAlert(storage, notify)).resolves.toBe(true);
    expect(notify).toHaveBeenCalledWith(
      "🧺 Basket Alert",
      expect.stringContaining("dropped below your"),
      "/stats",
    );
    expect(updateSettings).toHaveBeenCalledWith({ basketAlertThreshold: null });
  });

  it("does not fire above the threshold", async () => {
    const { storage, updateSettings } = makeStorage({
      notificationsEnabled: true,
      basketAlertThreshold: 50,
      displayCurrency: "USD",
    });
    const notify = vi.fn().mockResolvedValue(true);
    await expect(evaluateBasketAlert(storage, notify)).resolves.toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("stays quiet when notifications are disabled or the threshold is unset", async () => {
    for (const settings of [
      { notificationsEnabled: false, basketAlertThreshold: 100, displayCurrency: "USD" },
      { notificationsEnabled: true, basketAlertThreshold: null, displayCurrency: "USD" },
      { notificationsEnabled: true, basketAlertThreshold: 0, displayCurrency: "USD" },
    ]) {
      const { storage } = makeStorage(settings);
      const notify = vi.fn().mockResolvedValue(true);
      await expect(evaluateBasketAlert(storage, notify)).resolves.toBe(false);
      expect(notify).not.toHaveBeenCalled();
    }
  });

  it("keeps the threshold when the notification fails so it retries", async () => {
    const { storage, updateSettings } = makeStorage({
      notificationsEnabled: true,
      basketAlertThreshold: 100,
      displayCurrency: "USD",
    });
    const notify = vi.fn().mockResolvedValue(false);
    await expect(evaluateBasketAlert(storage, notify)).resolves.toBe(false);
    expect(notify).toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
