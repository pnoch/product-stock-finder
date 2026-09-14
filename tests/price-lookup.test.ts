import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(),
}));

import { createPriceLookup } from "../server/notifications/build-events";
import { getCachedPrice } from "../server/price-cache";

describe("createPriceLookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads each (distributor, model) at most once", async () => {
    vi.mocked(getCachedPrice).mockResolvedValue({
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    const lookup = createPriceLookup();
    await lookup("server2u-my", "CRS804");
    await lookup("server2u-my", "CRS804");
    await lookup("server2u-my", "CRS804");
    expect(getCachedPrice).toHaveBeenCalledTimes(1);

    await lookup("server2u-my", "CRS326");
    expect(getCachedPrice).toHaveBeenCalledTimes(2);
  });

  it("caches misses too, so a missing row is not re-read", async () => {
    vi.mocked(getCachedPrice).mockResolvedValue(null);
    const lookup = createPriceLookup();
    expect(await lookup("x", "y")).toBeNull();
    expect(await lookup("x", "y")).toBeNull();
    expect(getCachedPrice).toHaveBeenCalledTimes(1);
  });

  it("does not share state between ticks", async () => {
    vi.mocked(getCachedPrice).mockResolvedValue(null);
    const first = createPriceLookup();
    await first("a", "b");
    const second = createPriceLookup();
    await second("a", "b");
    expect(getCachedPrice).toHaveBeenCalledTimes(2);
  });
});
