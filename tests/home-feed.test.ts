import { describe, expect, it } from "vitest";
import { greetingFor, buildFeedItems } from "../lib/home-feed";
import type { PriceAlert, Product } from "../lib/types";

const alert = (over: Partial<PriceAlert> = {}): PriceAlert => ({
  id: "a1", productId: "p1", targetPrice: 90, currency: "USD",
  isActive: true, createdAt: new Date().toISOString(), ...over,
});

describe("greetingFor", () => {
  it("returns time-of-day greetings", () => {
    expect(greetingFor(3)).toBe("Good night");
    expect(greetingFor(9)).toBe("Good morning");
    expect(greetingFor(14)).toBe("Good afternoon");
    expect(greetingFor(21)).toBe("Good evening");
  });
});

describe("buildFeedItems", () => {
  it("returns quiet when nothing to show", () => {
    expect(buildFeedItems({ alerts: [], products: [], awaySummary: null, displayCurrency: "USD" }))
      .toEqual([{ kind: "quiet", dropCount: 0 }]);
  });

  it("orders alerts before drops before restocks", () => {
    const now = Date.now();
    const older = new Date(now - 3 * 86400000).toISOString();
    const newer = new Date(now - 86400000).toISOString();
    const products = [{
      id: "p1", name: "W", modelNumber: "W1", brand: "T", category: "Switch",
      description: "", isWatched: true, addedAt: newer,
      listings: [{
        distributorId: "d1", distributorName: "D1", price: 70, currency: "USD",
        stockStatus: "in_stock", url: "", lastChecked: newer,
        priceHistory: [
          { date: older, price: 100, currency: "USD" },
          { date: newer, price: 70, currency: "USD" },
        ],
      }],
    } as unknown as Product];
    const items = buildFeedItems({
      alerts: [alert({ triggeredAt: newer })],
      products,
      awaySummary: { priceDrops: [], priceRises: [], restocks: [{ productId: "p1", name: "W" }], stockOuts: [], since: 0 } as any,
      displayCurrency: "USD",
    });
    expect(items.map((i) => i.kind)).toEqual(["alerts", "drops", "restocks"]);
  });

  it("omits empty sections", () => {
    const items = buildFeedItems({ alerts: [alert()], products: [], awaySummary: null, displayCurrency: "USD" });
    // alert without triggeredAt is not fired; nothing else -> quiet
    expect(items).toEqual([{ kind: "quiet", dropCount: 0 }]);
  });
});
