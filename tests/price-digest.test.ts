import { describe, expect, it, vi } from "vitest";
import type { Product, PriceAlert, AppSettings, StockStatus } from "../lib/types";
import {
  computeDigest,
  formatDigestNotification,
  maybeSendDigest,
  type DigestSnapshot,
} from "../lib/price-digest";

function makeProduct(
  id: string,
  name: string,
  listings: { price: number; currency: string; stockStatus: string }[],
): Product {
  return {
    id,
    name,
    modelNumber: id,
    brand: "MikroTik",
    category: "Switch",
    description: "",
    addedAt: "2026-08-01T00:00:00.000Z",
    isWatched: true,
    listings: listings.map((l, i) => ({
      distributorId: `d${i}`,
      productId: id,
      price: l.price,
      currency: l.currency,
      stockStatus: l.stockStatus as StockStatus,
      url: "",
      lastChecked: "2026-08-11T00:00:00.000Z",
      priceHistory: [],
    })),
  };
}

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "daily",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    digestFrequency: "daily",
    ...overrides,
  };
}

function makeAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
  return {
    id: "a1",
    productId: "p1",
    targetPrice: 90,
    currency: "USD",
    isActive: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    triggeredAt: "2026-08-10T12:00:00.000Z",
    triggeredPrice: 85,
    ...overrides,
  };
}

const NOW = "2026-08-11T12:00:00.000Z";
const LAST = "2026-08-10T12:00:00.000Z";

describe("computeDigest", () => {
  it("detects a best-price change with the correct percentage", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "CRS804", bestPrice: 100, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(1);
    expect(result.priceChanges[0].name).toBe("CRS804");
    expect(result.priceChanges[0].from).toBe(100);
    expect(result.priceChanges[0].to).toBe(95);
    expect(result.priceChanges[0].percent).toBeCloseTo(-5, 1);
  });

  it("detects a stock-status transition", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "CRS804", bestPrice: null, stockStatus: "back_order" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.stockChanges).toHaveLength(1);
    expect(result.stockChanges[0].from).toBe("back_order");
    expect(result.stockChanges[0].to).toBe("in_stock");
  });

  it("reports alert targets hit within the window", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 85, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const alerts = [
      makeAlert({ triggeredAt: "2026-08-11T08:00:00.000Z" }), // inside window
      makeAlert({ id: "a2", productId: "p2", triggeredAt: "2026-08-09T08:00:00.000Z" }), // before window
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), alerts);
    expect(result.alertTargetsHit).toHaveLength(1);
    expect(result.alertTargetsHit[0].productId).toBe("p1");
  });

  it("excludes active (not-yet-triggered) alerts from targets hit", () => {
    const previous: DigestSnapshot = { lastDigestAt: LAST, products: [] };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 85, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const alerts = [makeAlert({ isActive: true, triggeredAt: undefined })];
    const result = computeDigest(previous, watchlist, makeSettings(), alerts);
    expect(result.alertTargetsHit).toHaveLength(0);
  });

  it("returns empty changes and a summary when nothing changed", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "CRS804", bestPrice: 95, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(0);
    expect(result.stockChanges).toHaveLength(0);
    expect(result.summary.inStock).toBe(1);
    expect(result.summary.totalValue).toBeCloseTo(95);
  });

  it("builds a snapshot from scratch when previous is null", () => {
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
      makeProduct("p2", "CRS326", [{ price: 50, currency: "USD", stockStatus: "back_order" }]),
    ];
    const result = computeDigest(null, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(0);
    expect(result.stockChanges).toHaveLength(0);
    expect(result.summary.inStock).toBe(1);
    expect(result.summary.backOrder).toBe(1);
    expect(result.summary.totalValue).toBeCloseTo(95);
  });

  it("converts prices to the display currency in the summary", () => {
    const previous: DigestSnapshot = { lastDigestAt: LAST, products: [] };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 92, currency: "EUR", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings({ displayCurrency: "USD" }), []);
    // 92 EUR / 0.92 = 100 USD
    expect(result.summary.totalValue).toBeCloseTo(100, 1);
  });
});

describe("formatDigestNotification", () => {
  it("formats a summary header with price and stock counts", () => {
    const result = formatDigestNotification({
      summary: { totalValue: 95, inStock: 1, backOrder: 1, outOfStock: 0, unknown: 0 },
      priceChanges: [],
      stockChanges: [],
      alertTargetsHit: [],
    });
    expect(result.title).toContain("Digest");
    expect(result.body).toContain("$95.00");
    expect(result.body).toContain("1 in stock");
    expect(result.body).toContain("1 back-order");
  });

  it("includes price-change and stock-change lines", () => {
    const result = formatDigestNotification({
      summary: { totalValue: 95, inStock: 1, backOrder: 0, outOfStock: 0, unknown: 0 },
      priceChanges: [{ productId: "p1", name: "CRS804", from: 100, to: 95, percent: -5 }],
      stockChanges: [{ productId: "p2", name: "CRS326", from: "back_order", to: "in_stock" }],
      alertTargetsHit: [],
    });
    expect(result.body).toContain("CRS804");
    expect(result.body).toContain("-5%");
    expect(result.body).toContain("CRS326");
    expect(result.body).toContain("in stock");
  });

  it("falls back to a no-changes body when nothing changed", () => {
    const result = formatDigestNotification({
      summary: { totalValue: 0, inStock: 0, backOrder: 0, outOfStock: 0, unknown: 0 },
      priceChanges: [],
      stockChanges: [],
      alertTargetsHit: [],
    });
    expect(result.body.toLowerCase()).toContain("no changes");
  });
});

describe("maybeSendDigest", () => {
  it("returns null when digestFrequency is off", async () => {
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(
      null,
      [],
      makeSettings({ digestFrequency: "off" }),
      [],
      send,
      NOW,
    );
    expect(result).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("returns null when not yet due", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-11T10:00:00.000Z", // 2h before NOW
      products: [],
    };
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(
      previous,
      [],
      makeSettings(),
      [],
      send,
      NOW,
    );
    expect(result).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a notification and returns a new snapshot when due", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-09T12:00:00.000Z", // 48h before NOW → due for daily
      products: [],
    };
    const send = vi.fn(async () => {});
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = await maybeSendDigest(
      previous,
      watchlist,
      makeSettings(),
      [],
      send,
      NOW,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result!.lastDigestAt).toBe(NOW);
    expect(result!.products).toHaveLength(1);
    expect(result!.products[0].bestPrice).toBe(95);
  });

  it("does not double-fire on concurrent due checks (first updates the window)", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-09T12:00:00.000Z",
      products: [],
    };
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(previous, [], makeSettings(), [], send, NOW);
    // After the first fires, re-check with the returned snapshot → not due
    const second = await maybeSendDigest(result, [], makeSettings(), [], send, NOW);
    expect(send).toHaveBeenCalledTimes(1);
    expect(second).toBeNull();
  });

  it("returns null (no crash) when the notification send fails", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-09T12:00:00.000Z",
      products: [],
    };
    const send = vi.fn(async () => {
      throw new Error("boom");
    });
    const result = await maybeSendDigest(previous, [], makeSettings(), [], send, NOW);
    expect(result).toBeNull();
  });

  it("applies weekly interval for digestFrequency weekly", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-04T12:00:00.000Z", // 7 days before NOW → due for weekly
      products: [],
    };
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(
      previous,
      [],
      makeSettings({ digestFrequency: "weekly" }),
      [],
      send,
      NOW,
    );
    expect(result).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
