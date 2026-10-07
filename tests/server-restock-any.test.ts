import { describe, expect, it } from "vitest";
import { buildEvents } from "../server/notifications/build-events";

// buildEvents takes an injectable price lookup. The "any" branch iterates the
// real parser ids (getAllParserIds), so key on one of them.
const getPrice = async (distributorId: string) => ({
  price: 100,
  currency: "USD",
  stockStatus: distributorId === "linitx-uk" ? "in_stock" : "back_order",
  url: "",
  fetchedAt: Date.now(),
});

describe("server restock — any scope", () => {
  it("fires when any distributor is in stock", async () => {
    const events = await buildEvents(
      {
        alerts: [],
        stockWatches: [
          { id: "w1", productId: "raspberry-pi-5-8gb", modelNumber: "SC1112", distributorId: "*", scope: "any" },
        ],
        dateReminders: [],
      } as never,
      Date.now(),
      getPrice as never,
    );
    expect(events.some((e) => e.type === "restock")).toBe(true);
  });

  it("does not fire when no distributor is in stock", async () => {
    const none = async () => ({
      price: 100, currency: "USD", stockStatus: "back_order", url: "", fetchedAt: Date.now(),
    });
    const events = await buildEvents(
      {
        alerts: [],
        stockWatches: [
          { id: "w1", productId: "raspberry-pi-5-8gb", modelNumber: "SC1112", distributorId: "*", scope: "any" },
        ],
        dateReminders: [],
      } as never,
      Date.now(),
      none as never,
    );
    expect(events.some((e) => e.type === "restock")).toBe(false);
  });
});
