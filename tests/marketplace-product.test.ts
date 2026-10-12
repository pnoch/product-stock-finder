import { describe, expect, it, vi } from "vitest";
import { buildMarketplaceProduct, isAutomaticProduct, parseManualPrice, updateMarketplacePrice } from "../lib/marketplace";
import { buildBackup, parseBackup } from "../lib/backup";
import { createStorage } from "../lib/storage";
import { applyServerPrice, deriveListingQueries } from "../lib/live-prices";
import { computeLocalDrops } from "../lib/price-leaderboard";
import { rediscoverMissingListings } from "../lib/manual-add";

vi.mock("../constants/oauth", () => ({ isServerConfigured: () => true }));
const serverFetch = vi.hoisted(() => vi.fn());
vi.mock("../lib/server-prices", () => ({ fetchServerPrice: serverFetch }));
import { resolvePrice } from "../lib/price-source";

const identity = { platform: "shopee", region: "TH", shopId: "1950119", itemId: "28177881956", canonicalUrl: "https://shopee.co.th/product/1950119/28177881956" } as const;
const input = { identity, name: "User confirmed product", variant: "Single option", seller: "User confirmed seller", price: "1200.50" };

describe("manual Shopee products", () => {
  it("builds a safe stable identity and explicitly manual unknown-stock THB listing", () => {
    const product = buildMarketplaceProduct(input);
    expect(product.id).toBe("shopee-th-1950119-28177881956");
    expect(product.marketplace).toEqual({ ...identity, variant: input.variant, seller: input.seller, monitoringStatus: "manual" });
    expect(product.listings).toHaveLength(1);
    expect(product.listings[0]).toMatchObject({ price: 1200.5, currency: "THB", priceSource: "manual", stockStatus: "unknown" });
    expect(isAutomaticProduct(product)).toBe(false);
    expect(isAutomaticProduct({ ...product, marketplace: undefined })).toBe(false);
  });
  it.each(["", "0", "-1", "NaN", "Infinity", "1e3", "1,000", "1.001", "10000001"])("rejects invalid price %s", (price) => {
    expect(parseManualPrice(price)).toBeNull();
    expect(() => buildMarketplaceProduct({ ...input, price })).toThrow();
  });
  it.each(["name", "variant", "seller"] as const)("requires confirmed %s", (field) => {
    expect(() => buildMarketplaceProduct({ ...input, [field]: " " })).toThrow();
  });
  it("rejects inconsistent source identity", () => {
    expect(() => buildMarketplaceProduct({ ...input, identity: { ...identity, itemId: "99" } })).toThrow();
  });
  it("appends dated manual history without changing prior points", () => {
    const initial = buildMarketplaceProduct(input, "2026-10-10T10:00:00.000Z");
    const next = updateMarketplacePrice(initial, "999", "2026-10-12T10:00:00.000Z");
    expect(initial.listings[0].priceHistory).toHaveLength(1);
    expect(next.listings[0].priceHistory).toEqual([...initial.listings[0].priceHistory, {
      date: "2026-10-12T10:00:00.000Z", price: 999, currency: "THB", stockStatus: "unknown", priceSource: "manual",
    }]);
    expect(computeLocalDrops([next], "30d", "THB")).toEqual([]);
  });
  it("survives storage, concurrent manual updates, acquired status and backup", async () => {
    const values = new Map<string, string>();
    const changes = vi.fn();
    const storage = createStorage({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async (key) => { values.delete(key); },
      multiRemove: async (keys) => { keys.forEach((key) => values.delete(key)); },
    }, { onChange: changes });
    const product = buildMarketplaceProduct(input);
    expect(await storage.addToWatchlist(product)).toBe(true);
    expect(await storage.addToWatchlist(product)).toBe(false);
    await Promise.all([storage.updateManualMarketplacePrice(product.id, "1100"), storage.updateManualMarketplacePrice(product.id, "1000")]);
    await storage.updateProductAcquired(product.id, "2026-10-12T10:00:00.000Z");
    const watchlist = await storage.getWatchlist();
    expect(watchlist[0].listings[0].priceHistory.map((p) => p.price)).toEqual([1200.5, 1100, 1000]);
    expect(watchlist[0].marketplace).toEqual(product.marketplace);
    expect(watchlist[0].acquiredAt).toBeDefined();
    expect(changes).toHaveBeenCalledWith("watchlist", product.id);
    const backup = buildBackup({ watchlist, alerts: [], reminders: [], stockWatches: [], settings: await storage.getSettings() });
    expect(parseBackup(backup)?.watchlist).toEqual(watchlist);
  });
  it("never queries or applies automatic prices, even with a known distributor", async () => {
    const product = buildMarketplaceProduct(input);
    const listing = { ...product.listings[0], distributorId: "mikrotik" };
    expect(deriveListingQueries(product.modelNumber, [listing])[0].enabled).toBe(false);
    expect(await resolvePrice("mikrotik", product.modelNumber)).toBeNull();
    expect(serverFetch).not.toHaveBeenCalled();
    expect(applyServerPrice(listing, { snapshot: { price: 1, currency: "USD", stockStatus: "in_stock", url: "https://example.com", fetchedAt: Date.now() }, history: [] })).toBe(listing);
  });
  it("does not rediscover a marketplace product whose listings are missing", async () => {
    const product = { ...buildMarketplaceProduct(input), listings: [] };
    const discover = vi.fn();
    expect(await rediscoverMissingListings({ storage: { getWatchlist: async () => [product], updateProductListings: vi.fn() }, discover })).toEqual({ scanned: 0, discovered: 0 });
    expect(discover).not.toHaveBeenCalled();
  });
});
