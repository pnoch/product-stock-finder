import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeLocalDrops,
  buildDropShareText,
  formatDropPct,
  type PriceDrop,
} from "@/lib/price-leaderboard";
import type { Product } from "@/lib/types";

function makeProduct(overrides: Partial<Product> & { listings?: Product["listings"] } = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    modelNumber: "M1",
    listings: [],
    ...overrides,
  } as Product;
}

function makePricePoint(date: string, price: number, currency = "USD") {
  return { date, price, currency };
}

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

describe("computeLocalDrops", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty for empty products", () => {
    expect(computeLocalDrops([], "7d", "USD")).toEqual([]);
  });

  it("returns empty when listing has only one price point", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [makePricePoint(hoursAgo(1), 100)],
        },
      ],
    } as any);
    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
  });

  it("detects a price drop within the window", () => {
    const product = makeProduct({
      id: "p1",
      name: "Widget",
      modelNumber: "W1",
      listings: [
        {
          distributorId: "d1",
          priceHistory: [
            makePricePoint(daysAgo(2), 200),
            makePricePoint(hoursAgo(1), 150),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "7d", "USD");
    expect(drops).toHaveLength(1);
    expect(drops[0].productId).toBe("p1");
    expect(drops[0].distributorId).toBe("d1");
    expect(drops[0].previousPrice).toBe(200);
    expect(drops[0].currentPrice).toBe(150);
    expect(drops[0].dropPct).toBeCloseTo(25);
    expect(drops[0].dropAbs).toBe(50);
  });

  it("ignores price drops outside the window", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(10), 200),
            makePricePoint(daysAgo(8), 150),
          ],
        },
      ],
    } as any);

    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
  });

  it("sorts by percentage by default (descending)", () => {
    const products = [
      makeProduct({
        id: "p1",
        name: "A",
        modelNumber: "A",
        listings: [
          {
            distributorId: "d1",
  
            priceHistory: [
              makePricePoint(daysAgo(2), 100),
              makePricePoint(hoursAgo(1), 90),
            ],
          },
        ],
      } as any),
      makeProduct({
        id: "p2",
        name: "B",
        modelNumber: "B",
        listings: [
          {
            distributorId: "d2",
  
            priceHistory: [
              makePricePoint(daysAgo(2), 200),
              makePricePoint(hoursAgo(1), 100),
            ],
          },
        ],
      } as any),
    ];

    const drops = computeLocalDrops(products, "7d", "USD", "pct");
    expect(drops).toHaveLength(2);
    expect(drops[0].productId).toBe("p2");
    expect(drops[1].productId).toBe("p1");
  });

  it("sorts by absolute drop when requested", () => {
    const products = [
      makeProduct({
        id: "p1",
        name: "A",
        modelNumber: "A",
        listings: [
          {
            distributorId: "d1",
  
            priceHistory: [
              makePricePoint(daysAgo(2), 100),
              makePricePoint(hoursAgo(1), 80),
            ],
          },
        ],
      } as any),
      makeProduct({
        id: "p2",
        name: "B",
        modelNumber: "B",
        listings: [
          {
            distributorId: "d2",
  
            priceHistory: [
              makePricePoint(daysAgo(2), 200),
              makePricePoint(hoursAgo(1), 150),
            ],
          },
        ],
      } as any),
    ];

    const drops = computeLocalDrops(products, "7d", "USD", "abs");
    expect(drops).toHaveLength(2);
    expect(drops[0].productId).toBe("p2");
    expect(drops[0].dropAbs).toBe(50);
    expect(drops[1].productId).toBe("p1");
    expect(drops[1].dropAbs).toBe(20);
  });

  it("respects the limit parameter", () => {
    const products = Array.from({ length: 5 }, (_, i) =>
      makeProduct({
        id: `p${i}`,
        name: `P${i}`,
        modelNumber: `M${i}`,
        listings: [
          {
            distributorId: `d${i}`,

            priceHistory: [
              makePricePoint(daysAgo(2), 100),
              makePricePoint(hoursAgo(1), 100 - i * 5),
            ],
          },
        ],
      } as any),
    );

    const drops = computeLocalDrops(products, "7d", "USD", "pct", 3);
    expect(drops).toHaveLength(3);
  });

  it("deduplicates: keeps biggest drop per product+distributor", () => {
    const product = makeProduct({
      id: "p1",
      name: "Widget",
      modelNumber: "W1",
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(6), 200),
            makePricePoint(daysAgo(3), 180),
            makePricePoint(hoursAgo(1), 140),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "7d", "USD");
    expect(drops).toHaveLength(1);
    expect(drops[0].dropPct).toBeCloseTo(30);
  });

  it("ignores price increases (no drop)", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(2), 100),
            makePricePoint(hoursAgo(1), 120),
          ],
        },
      ],
    } as any);

    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
  });

  it("ignores price points with invalid dates", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            { date: "not-a-date", price: 100, currency: "USD" },
            makePricePoint(daysAgo(2), 200),
            makePricePoint(hoursAgo(1), 150),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "7d", "USD");
    expect(drops).toHaveLength(1);
    expect(drops[0].previousPrice).toBe(200);
    expect(drops[0].currentPrice).toBe(150);
  });

  it("returns empty when all window points are filtered out", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            { date: "not-a-date", price: 100, currency: "USD" },
            { date: "also-bad", price: 50, currency: "USD" },
          ],
        },
      ],
    } as any);

    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
  });

  it("handles products with no listings", () => {
    const product = makeProduct({ listings: undefined } as any);
    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
  });

  it("handles multiple distributors for same product", () => {
    const product = makeProduct({
      id: "p1",
      name: "Widget",
      modelNumber: "W1",
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(2), 100),
            makePricePoint(hoursAgo(1), 80),
          ],
        },
        {
          distributorId: "d2",

          priceHistory: [
            makePricePoint(daysAgo(2), 200),
            makePricePoint(hoursAgo(1), 180),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "7d", "USD", "pct");
    expect(drops).toHaveLength(2);
    expect(drops[0].distributorId).toBe("d1");
    expect(drops[1].distributorId).toBe("d2");
  });

  it("uses product.modelNumber when name is missing", () => {
    const product = makeProduct({
      id: "p1",
      name: undefined,
      modelNumber: "MN-100",
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(2), 100),
            makePricePoint(hoursAgo(1), 80),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "7d", "USD");
    expect(drops[0].productName).toBe("MN-100");
  });

  it("sets distributorName to distributorId (no separate name field)", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d-abc",
          priceHistory: [
            makePricePoint(daysAgo(2), 100),
            makePricePoint(hoursAgo(1), 80),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "7d", "USD");
    expect(drops[0].distributorName).toBe("d-abc");
  });

  it("works with 24h window", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(hoursAgo(20), 200),
            makePricePoint(hoursAgo(1), 150),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "24h", "USD");
    expect(drops).toHaveLength(1);
  });

  it("filters out drops outside 24h window", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(2), 200),
            makePricePoint(daysAgo(1), 150),
          ],
        },
      ],
    } as any);

    expect(computeLocalDrops([product], "24h", "USD")).toEqual([]);
  });

  it("works with 30d window", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(25), 200),
            makePricePoint(daysAgo(1), 150),
          ],
        },
      ],
    } as any);

    const drops = computeLocalDrops([product], "30d", "USD");
    expect(drops).toHaveLength(1);
  });

  it("zero previous price yields 0% drop", () => {
    const product = makeProduct({
      listings: [
        {
          distributorId: "d1",

          priceHistory: [
            makePricePoint(daysAgo(2), 0),
            makePricePoint(hoursAgo(1), 0),
          ],
        },
      ],
    } as any);

    expect(computeLocalDrops([product], "7d", "USD")).toEqual([]);
  });
});

describe("formatDropPct", () => {
  it("never renders a nonsensical -0%", () => {
    expect(formatDropPct(0.35)).toBe("\u22120.3%");
    expect(formatDropPct(0.3)).toBe("\u22120.3%");
    expect(formatDropPct(0.04)).toBe("\u2212<0.1%");
    expect(formatDropPct(0)).toBe("\u2212<0.1%");
  });

  it("keeps one decimal below 10%", () => {
    expect(formatDropPct(1)).toBe("\u22121.0%");
    expect(formatDropPct(9.94)).toBe("\u22129.9%");
  });

  it("rounds to whole percent at 10% and above", () => {
    expect(formatDropPct(10)).toBe("\u221210%");
    expect(formatDropPct(25)).toBe("\u221225%");
    expect(formatDropPct(12.6)).toBe("\u221213%");
  });

  it("uses the magnitude so positive inputs render as drops", () => {
    expect(formatDropPct(-25)).toBe(formatDropPct(25));
  });
});

describe("buildDropShareText", () => {
  it("formats drops into share text with header and footer", () => {
    const drops: PriceDrop[] = [
      {
        productId: "p1",
        productName: "Widget",
        modelNumber: "W1",
        distributorId: "d1",
        distributorName: "Store A",
        previousPrice: 200,
        currentPrice: 150,
        currency: "USD",
        dropPct: 25,
        dropAbs: 50,
        droppedAt: daysAgo(2),
      },
    ];

    const text = buildDropShareText(drops, "7d", "pct");
    expect(text).toContain("Price Drops (7d, by %)");
    expect(text).toContain("1. Widget (Store A)");
    expect(text).toContain("via Product Stock Finder");
  });

  it("truncates to 10 drops", () => {
    const drops: PriceDrop[] = Array.from({ length: 15 }, (_, i) => ({
      productId: `p${i}`,
      productName: `Product ${i}`,
      modelNumber: `M${i}`,
      distributorId: `d${i}`,
      distributorName: `Store ${i}`,
      previousPrice: 100,
      currentPrice: 90,
      currency: "USD",
      dropPct: 10,
      dropAbs: 10,
      droppedAt: daysAgo(1),
    }));

    const text = buildDropShareText(drops, "7d", "pct");
    const lines = text.split("\n").filter((l) => /^\d+\./.test(l));
    expect(lines).toHaveLength(10);
  });

  it("shows $ sort label when sortBy is abs", () => {
    const text = buildDropShareText([], "30d", "abs");
    expect(text).toContain("by $");
  });

  it("shows correct window labels", () => {
    expect(buildDropShareText([], "24h", "pct")).toContain("24h");
    expect(buildDropShareText([], "7d", "pct")).toContain("7d");
    expect(buildDropShareText([], "30d", "pct")).toContain("30d");
  });
});