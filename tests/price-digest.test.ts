import { describe, expect, it, vi } from "vitest";
import type {
  Product,
  PriceAlert,
  AppSettings,
  StockStatus,
} from "../lib/types";
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
    healthAlerts: true,
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
        {
          productId: "p1",
          name: "CRS804",
          bestPrice: 100,
          stockStatus: "in_stock",
        },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [
        { price: 95, currency: "USD", stockStatus: "in_stock" },
      ]),
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
        {
          productId: "p1",
          name: "CRS804",
          bestPrice: null,
          stockStatus: "back_order",
        },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [
        { price: 95, currency: "USD", stockStatus: "in_stock" },
      ]),
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
      makeProduct("p1", "CRS804", [
        { price: 85, currency: "USD", stockStatus: "in_stock" },
      ]),
    ];
    const alerts = [
      makeAlert({ triggeredAt: "2026-08-11T08:00:00.000Z" }), // inside window
      makeAlert({
        id: "a2",
        productId: "p2",
        triggeredAt: "2026-08-09T08:00:00.000Z",
      }), // before window
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), alerts);
    expect(result.alertTargetsHit).toHaveLength(1);
    expect(result.alertTargetsHit[0].productId).toBe("p1");
  });

  it("excludes active (not-yet-triggered) alerts from targets hit", () => {
    const previous: DigestSnapshot = { lastDigestAt: LAST, products: [] };
    const watchlist = [
      makeProduct("p1", "CRS804", [
        { price: 85, currency: "USD", stockStatus: "in_stock" },
      ]),
    ];
    const alerts = [makeAlert({ isActive: true, triggeredAt: undefined })];
    const result = computeDigest(previous, watchlist, makeSettings(), alerts);
    expect(result.alertTargetsHit).toHaveLength(0);
  });

  it("returns empty changes and a summary when nothing changed", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        {
          productId: "p1",
          name: "CRS804",
          bestPrice: 95,
          stockStatus: "in_stock",
        },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [
        { price: 95, currency: "USD", stockStatus: "in_stock" },
      ]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(0);
    expect(result.stockChanges).toHaveLength(0);
    expect(result.summary.inStock).toBe(1);
    expect(result.summary.totalValue).toBeCloseTo(95);
  });

  it("builds a snapshot from scratch when previous is null", () => {
    const watchlist = [
      makeProduct("p1", "CRS804", [
        { price: 95, currency: "USD", stockStatus: "in_stock" },
      ]),
      makeProduct("p2", "CRS326", [
        { price: 50, currency: "USD", stockStatus: "back_order" },
      ]),
    ];
    const result = computeDigest(null, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(0);
    expect(result.stockChanges).toHaveLength(0);
    expect(result.summary.inStock).toBe(1);
    expect(result.summary.backOrder).toBe(1);
    expect(result.summary.totalValue).toBeCloseTo(145);
  });

  it("converts prices to the display currency in the summary", () => {
    const previous: DigestSnapshot = { lastDigestAt: LAST, products: [] };
    const watchlist = [
      makeProduct("p1", "CRS804", [
        { price: 92, currency: "EUR", stockStatus: "in_stock" },
      ]),
    ];
    const result = computeDigest(
      previous,
      watchlist,
      makeSettings({ displayCurrency: "USD" }),
      [],
    );
    // 92 EUR / 0.92 = 100 USD
    expect(result.summary.totalValue).toBeCloseTo(100, 1);
  });
});

describe("formatDigestNotification", () => {
  it("formats a summary header with price and stock counts", () => {
    const result = formatDigestNotification({
      summary: {
        totalValue: 95,
        inStock: 1,
        backOrder: 1,
        outOfStock: 0,
        unknown: 0,
      },
      valueDelta: null,
      newProducts: [],
      removedProducts: [],
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
      summary: {
        totalValue: 95,
        inStock: 1,
        backOrder: 0,
        outOfStock: 0,
        unknown: 0,
      },
      priceChanges: [
        { productId: "p1", name: "CRS804", from: 100, to: 95, percent: -5 },
      ],
      stockChanges: [
        { productId: "p2", name: "CRS326", from: "back_order", to: "in_stock" },
      ],
      valueDelta: null,
      newProducts: [],
      removedProducts: [],
      alertTargetsHit: [],
    });
    expect(result.body).toContain("CRS804");
    expect(result.body).toContain("-5%");
    expect(result.body).toContain("CRS326");
    expect(result.body).toContain("in stock");
  });

  it("falls back to a no-changes body when nothing changed", () => {
    const result = formatDigestNotification({
      summary: {
        totalValue: 0,
        inStock: 0,
        backOrder: 0,
        outOfStock: 0,
        unknown: 0,
      },
      valueDelta: null,
      newProducts: [],
      removedProducts: [],
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
      makeProduct("p1", "CRS804", [
        { price: 95, currency: "USD", stockStatus: "in_stock" },
      ]),
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
    const result = await maybeSendDigest(
      previous,
      [],
      makeSettings(),
      [],
      send,
      NOW,
    );
    // After the first fires, re-check with the returned snapshot → not due
    const second = await maybeSendDigest(
      result,
      [],
      makeSettings(),
      [],
      send,
      NOW,
    );
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
    const result = await maybeSendDigest(
      previous,
      [],
      makeSettings(),
      [],
      send,
      NOW,
    );
    expect(result).toBeNull();
  });

  it("applies weekly interval for digestFrequency weekly", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-04T12:00:00.000Z", // 7 days before NOW → due for weekly
      products: [],
    };
    const send = vi.fn(async () => {});
    // NOW (2026-08-11) is a Tuesday → weekday 2
    const result = await maybeSendDigest(
      previous,
      [],
      makeSettings({ digestFrequency: "weekly", digestDayOfWeek: 2 }),
      [],
      send,
      NOW,
    );
    expect(result).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("digest enhancements", () => {
  it("computes valueDelta across snapshots", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "A", bestPrice: 100, stockStatus: "in_stock" },
        { productId: "p2", name: "B", bestPrice: 50, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "A", [{ price: 120, currency: "USD", stockStatus: "in_stock" }]),
      makeProduct("p2", "B", [{ price: 40, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.valueDelta).not.toBeNull();
    expect(result.valueDelta!.from).toBe(150);
    expect(result.valueDelta!.to).toBe(160);
    expect(result.valueDelta!.percent).toBeCloseTo(6.67, 1);
  });

  it("returns null valueDelta when previous is missing", () => {
    const watchlist = [
      makeProduct("p1", "A", [{ price: 100, currency: "USD", stockStatus: "in_stock" }]),
    ];
    expect(computeDigest(null, watchlist, makeSettings(), []).valueDelta).toBeNull();
  });

  it("sorts price changes by absolute percent descending", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "Small", bestPrice: 100, stockStatus: "in_stock" },
        { productId: "p2", name: "Big", bestPrice: 100, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "Small", [{ price: 105, currency: "USD", stockStatus: "in_stock" }]),
      makeProduct("p2", "Big", [{ price: 130, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.priceChanges[0].name).toBe("Big");
    expect(result.priceChanges[1].name).toBe("Small");
  });

  it("detects added and removed products", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "keep", name: "Keep", bestPrice: 10, stockStatus: "in_stock" },
        { productId: "gone", name: "Gone", bestPrice: 20, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("keep", "Keep", [{ price: 10, currency: "USD", stockStatus: "in_stock" }]),
      makeProduct("new1", "New", [{ price: 30, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.newProducts.map((p) => p.productId)).toEqual(["new1"]);
    expect(result.removedProducts.map((p) => p.productId)).toEqual(["gone"]);
  });

  it("leads the notification with value delta and biggest mover", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "Mover", bestPrice: 100, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "Mover", [{ price: 80, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const { body } = formatDigestNotification(
      computeDigest(previous, watchlist, makeSettings(), []),
    );
    const lines = body.split("\n");
    expect(lines[0]).toMatch(/Watchlist value \$100\.00 → \$80\.00/);
    expect(lines[0]).toContain("-20.0%");
    expect(body).toContain("Mover: -20%");
  });
});

describe("digest schedule", () => {
  it("weekly fires only on the chosen weekday", async () => {
    const send = vi.fn(async () => {});
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-10T12:00:00.000Z", // Monday
      products: [],
    };
    const watchlist = [
      makeProduct("p1", "A", [{ price: 100, currency: "USD", stockStatus: "in_stock" }]),
    ];
    // NOW is Saturday (+2d) — past interval but wrong weekday
    const wrongDay = await maybeSendDigest(
      previous,
      watchlist,
      makeSettings({ digestFrequency: "weekly", digestDayOfWeek: 0 }),
      [],
      send,
      NOW,
    );
    expect(wrongDay).toBeNull();
    expect(send).not.toHaveBeenCalled();

    const sunday = new Date(Date.parse("2026-08-16T12:00:00Z")).toISOString();
    const rightDay = await maybeSendDigest(
      { ...previous, lastDigestAt: "2026-08-09T12:00:00.000Z" },
      watchlist,
      makeSettings({ digestFrequency: "weekly", digestDayOfWeek: 0 }),
      [],
      send,
      sunday,
    );
    expect(rightDay).not.toBeNull();
    expect(send).toHaveBeenCalled();
  });

  it("daily ignores the weekday gate", async () => {
    const send = vi.fn(async () => {});
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-10T12:00:00.000Z",
      products: [],
    };
    const result = await maybeSendDigest(
      previous,
      [
        makeProduct("p1", "A", [{ price: 100, currency: "USD", stockStatus: "in_stock" }]),
      ],
      makeSettings({ digestFrequency: "daily" }),
      [],
      send,
      NOW, // Saturday
    );
    expect(result).not.toBeNull();
    expect(send).toHaveBeenCalled();
  });
});
