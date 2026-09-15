import { describe, expect, it, vi } from "vitest";
import { maybeSendDigest } from "../lib/price-digest";

function settings(over: Record<string, unknown> = {}) {
  return { displayCurrency: "USD", digestFrequency: "daily", ...over } as any;
}

function product(id: string, price: number) {
  return {
    id,
    name: id,
    modelNumber: id,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings: [{ distributorId: "a", productId: id, price, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: new Date().toISOString(), priceHistory: [] }],
  } as any;
}

describe("maybeSendDigest quietHours", () => {
  it("defers digest when in quiet hours", async () => {
    const send = vi.fn(async () => true);
    const now = new Date("2026-08-04T23:30:00");
    const qh = { start: "22:00", end: "07:00" };
    const result = await maybeSendDigest(null, [product("p1", 100)], settings({ quietHours: qh }), [], send, now.toISOString());
    expect(send).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("sends digest when outside quiet hours", async () => {
    const send = vi.fn(async () => true);
    const now = new Date("2026-08-04T08:00:00");
    const qh = { start: "22:00", end: "07:00" };
    const result = await maybeSendDigest(null, [product("p1", 100)], settings({ quietHours: qh }), [], send, now.toISOString());
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
  });
});
