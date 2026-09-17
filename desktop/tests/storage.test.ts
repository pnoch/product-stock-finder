// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { createStorage } from "../../lib/storage";

// In-memory localStorage mock
const store = new Map<string, string>();
const localStorageAdapter = {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  multiRemove: async (keys: string[]) => keys.forEach((k) => store.delete(k)),
};

const storage = createStorage(localStorageAdapter);

beforeEach(() => {
  store.clear();
});

describe("StorageAdapter", () => {
  it("should get empty watchlist by default", async () => {
    const result = await storage.getWatchlist();
    expect(result).toEqual([]);
  });

  it("should add and retrieve products", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("test-1");
  });

  it("should not add duplicate products", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    await storage.addToWatchlist(product);
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(1);
  });

  it("should remove products", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    await storage.removeFromWatchlist("test-1");
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(0);
  });

  it("should get empty alerts by default", async () => {
    const result = await storage.getAlerts();
    expect(result).toEqual([]);
  });

  it("should add and retrieve alerts", async () => {
    const alert = {
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await storage.addAlert(alert);
    const alerts = await storage.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("alert-1");
  });

  it("should toggle alerts", async () => {
    const alert = {
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await storage.addAlert(alert);
    await storage.toggleAlert("alert-1");
    const alerts = await storage.getAlerts();
    expect(alerts[0].isActive).toBe(false);
  });

  it("should rearm triggered alerts", async () => {
    const alert = {
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: false,
      createdAt: new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
      triggeredPrice: 90,
    };
    await storage.addAlert(alert);
    await storage.rearmAlert("alert-1");
    const alerts = await storage.getAlerts();
    expect(alerts[0].isActive).toBe(true);
    expect(alerts[0].triggeredAt).toBeUndefined();
  });

  it("should get default settings", async () => {
    const settings = await storage.getSettings();
    expect(settings.theme).toBe("auto");
    expect(settings.displayCurrency).toBe("USD");
  });

  it("should save and retrieve settings", async () => {
    const settings = await storage.getSettings();
    settings.displayCurrency = "EUR";
    await storage.saveSettings(settings);
    const loaded = await storage.getSettings();
    expect(loaded.displayCurrency).toBe("EUR");
  });

  it("should clear all data", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    await storage.addAlert({
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await storage.clearAllData();
    const list = await storage.getWatchlist();
    const alerts = await storage.getAlerts();
    expect(list).toEqual([]);
    expect(alerts).toEqual([]);
  });
});
