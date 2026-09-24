import { describe, it, expect, vi } from "vitest";
import { backfillLocalHistory } from "../src/lib/history-sync";

function point(date: string, price: number) {
  return { date, price, currency: "USD", stockStatus: "in_stock" as const };
}

function makeClient() {
  return {
    prices: {
      uploadHistory: {
        mutate: vi.fn().mockResolvedValue({ accepted: 1 }),
      },
    },
  };
}

function product(modelNumber: string, listings: unknown[]) {
  return { modelNumber, listings } as never;
}

describe("backfillLocalHistory", () => {
  it("uploads each listing's history and counts confirmed uploads", async () => {
    const client = makeClient();
    const watchlist = [
      product("A", [
        { distributorId: "d1", priceHistory: [point("2026-01-01T00:00:00.000Z", 10)] },
        { distributorId: "d2", priceHistory: [] },
      ]),
      product("B", [
        { distributorId: "d3", priceHistory: [point("2026-01-02T00:00:00.000Z", 20)] },
      ]),
    ];
    await expect(backfillLocalHistory(client, watchlist)).resolves.toBe(2);
    expect(client.prices.uploadHistory.mutate).toHaveBeenCalledTimes(2);
    expect(client.prices.uploadHistory.mutate.mock.calls[0][0]).toMatchObject({
      distributorId: "d1",
      modelNumber: "A",
    });
  });

  it("caps points to MAX_UPLOAD_HISTORY_POINTS, keeping the newest", async () => {
    const client = makeClient();
    const history = Array.from({ length: 250 }, (_, i) =>
      point(`2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`, i + 1),
    );
    await backfillLocalHistory(client, [
      product("A", [{ distributorId: "d1", priceHistory: history }]),
    ]);
    const sent = client.prices.uploadHistory.mutate.mock.calls[0][0] as {
      points: { price: number }[];
    };
    expect(sent.points).toHaveLength(200);
    expect(sent.points[0].price).toBe(51);
  });

  it("continues past a rejected listing", async () => {
    const client = makeClient();
    client.prices.uploadHistory.mutate
      .mockRejectedValueOnce(new Error("unknown distributor"))
      .mockResolvedValueOnce({ accepted: 1 });
    const watchlist = [
      product("A", [
        { distributorId: "bad", priceHistory: [point("2026-01-01T00:00:00.000Z", 10)] },
        { distributorId: "d2", priceHistory: [point("2026-01-01T00:00:00.000Z", 11)] },
      ]),
    ];
    await expect(backfillLocalHistory(client, watchlist)).resolves.toBe(1);
    expect(client.prices.uploadHistory.mutate).toHaveBeenCalledTimes(2);
  });
});
