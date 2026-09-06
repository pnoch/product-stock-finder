import { describe, it, expect } from "vitest";
import { detectPriceEvents, getEventColor } from "@/lib/price-events";
import type { PricePoint } from "@/lib/types";

function point(
  date: string,
  price: number,
  stockStatus: PricePoint["stockStatus"] = "in_stock",
): PricePoint {
  return { date, price, currency: "USD", stockStatus };
}

const colors = { success: "green", warning: "amber", error: "red" };

describe("detectPriceEvents", () => {
  it("returns [] for empty history", () => {
    expect(detectPriceEvents([])).toEqual([]);
  });

  it("returns [] for a single point", () => {
    expect(detectPriceEvents([point("2026-01-01", 100)])).toEqual([]);
  });

  it("returns [] for nullish input", () => {
    expect(detectPriceEvents(undefined as never)).toEqual([]);
    expect(detectPriceEvents(null as never)).toEqual([]);
  });

  it("detects a price drop at or beyond -5%", () => {
    const events = detectPriceEvents([
      point("2026-01-01", 100),
      point("2026-01-02", 90),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("price_drop");
    expect(events[0].index).toBe(1);
    expect(events[0].date).toBe("2026-01-02");
    expect(events[0].price).toBe(90);
    expect(events[0].prevPrice).toBe(100);
  });

  it("detects a price rise at or beyond +5%", () => {
    const events = detectPriceEvents([
      point("2026-01-01", 100),
      point("2026-01-02", 110),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("price_rise");
  });

  it("fires on the exact 5% boundary (inclusive thresholds)", () => {
    expect(
      detectPriceEvents([point("2026-01-01", 100), point("2026-01-02", 95)])
        .map((e) => e.type),
    ).toEqual(["price_drop"]);
    expect(
      detectPriceEvents([point("2026-01-01", 100), point("2026-01-02", 105)])
        .map((e) => e.type),
    ).toEqual(["price_rise"]);
  });

  it("emits no event for equal prices or sub-threshold changes", () => {
    expect(
      detectPriceEvents([point("2026-01-01", 100), point("2026-01-02", 100)]),
    ).toEqual([]);
    expect(
      detectPriceEvents([point("2026-01-01", 100), point("2026-01-02", 99)]),
    ).toEqual([]);
    expect(
      detectPriceEvents([point("2026-01-01", 100), point("2026-01-02", 101)]),
    ).toEqual([]);
  });

  it("sorts unsorted dates ascending and indexes into sorted order", () => {
    const events = detectPriceEvents([
      point("2026-01-03", 90),
      point("2026-01-01", 100),
      point("2026-01-02", 100),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("price_drop");
    expect(events[0].index).toBe(2);
    expect(events[0].date).toBe("2026-01-03");
  });

  it("does not mutate the input array when sorting", () => {
    const history = [
      point("2026-01-02", 90),
      point("2026-01-01", 100),
    ];
    detectPriceEvents(history);
    expect(history[0].date).toBe("2026-01-02");
  });

  it("detects restock on out_of_stock → in_stock", () => {
    const events = detectPriceEvents([
      point("2026-01-01", 100, "out_of_stock"),
      point("2026-01-02", 100, "in_stock"),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("restock");
    expect(events[0].prevStockStatus).toBe("out_of_stock");
    expect(events[0].stockStatus).toBe("in_stock");
  });

  it("detects restock from back_order and unknown too", () => {
    for (const prev of ["back_order", "unknown"] as const) {
      const events = detectPriceEvents([
        point("2026-01-01", 100, prev),
        point("2026-01-02", 100, "in_stock"),
      ]);
      expect(events.map((e) => e.type)).toEqual(["restock"]);
    }
  });

  it("restock takes precedence over a simultaneous price change", () => {
    const events = detectPriceEvents([
      point("2026-01-01", 100, "out_of_stock"),
      point("2026-01-02", 50, "in_stock"),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("restock");
    expect(events[0].price).toBe(50);
    expect(events[0].prevPrice).toBe(100);
  });

  it("emits no restock when already in_stock", () => {
    expect(
      detectPriceEvents([
        point("2026-01-01", 100, "in_stock"),
        point("2026-01-02", 100, "in_stock"),
      ]),
    ).toEqual([]);
  });

  it("emits no event when stock leaves in_stock without a price move", () => {
    expect(
      detectPriceEvents([
        point("2026-01-01", 100, "in_stock"),
        point("2026-01-02", 100, "out_of_stock"),
      ]),
    ).toEqual([]);
  });

  it("detects price moves while out of stock (no restock involved)", () => {
    const drop = detectPriceEvents([
      point("2026-01-01", 100, "out_of_stock"),
      point("2026-01-02", 80, "out_of_stock"),
    ]);
    expect(drop.map((e) => e.type)).toEqual(["price_drop"]);
    const rise = detectPriceEvents([
      point("2026-01-01", 100, "back_order"),
      point("2026-01-02", 120, "back_order"),
    ]);
    expect(rise.map((e) => e.type)).toEqual(["price_rise"]);
  });

  it("skips pairs with an invalid date", () => {
    expect(
      detectPriceEvents([
        point("not-a-date", 100),
        point("2026-01-02", 50),
      ]),
    ).toEqual([]);
    expect(
      detectPriceEvents([
        point("2026-01-01", 100),
        point("also-bad", 50),
      ]),
    ).toEqual([]);
  });

  it("emits no event when either price is zero", () => {
    expect(
      detectPriceEvents([point("2026-01-01", 0), point("2026-01-02", 100)]),
    ).toEqual([]);
    expect(
      detectPriceEvents([point("2026-01-01", 100), point("2026-01-02", 0)]),
    ).toEqual([]);
    expect(
      detectPriceEvents([point("2026-01-01", 0), point("2026-01-02", 0)]),
    ).toEqual([]);
  });

  it("emits no event for non-finite prices → no event", () => {
    expect(
      detectPriceEvents([
        point("2026-01-01", 100),
        point("2026-01-02", NaN),
      ]),
    ).toEqual([]);
    expect(
      detectPriceEvents([
        point("2026-01-01", NaN),
        point("2026-01-02", 100),
      ]),
    ).toEqual([]);
    expect(
      detectPriceEvents([
        point("2026-01-01", 100),
        point("2026-01-02", Infinity),
      ]),
    ).toEqual([]);
    expect(
      detectPriceEvents([
        point("2026-01-01", Infinity),
        point("2026-01-02", 100),
      ]),
    ).toEqual([]);
    expect(
      detectPriceEvents([
        point("2026-01-01", 100),
        point("2026-01-02", -Infinity),
      ]),
    ).toEqual([]);
    expect(
      detectPriceEvents([
        point("2026-01-01", -Infinity),
        point("2026-01-02", 100),
      ]),
    ).toEqual([]);
    expect(
      detectPriceEvents([
        point("2026-01-01", Infinity),
        point("2026-01-02", Infinity),
      ]),
    ).toEqual([]);
  });

  it("emits no event for negative prices (fails the > 0 guard)", () => {
    expect(
      detectPriceEvents([
        point("2026-01-01", 100),
        point("2026-01-02", -50),
      ]),
    ).toEqual([]);
  });

  it("detects multiple events across a longer history", () => {
    const events = detectPriceEvents([
      point("2026-01-01", 100),
      point("2026-01-02", 90),
      point("2026-01-03", 90),
      point("2026-01-04", 110),
    ]);
    expect(events.map((e) => e.type)).toEqual(["price_drop", "price_rise"]);
    expect(events.map((e) => e.index)).toEqual([1, 3]);
  });
});

describe("getEventColor", () => {
  it("maps restock → success", () => {
    expect(getEventColor("restock", colors)).toBe("green");
  });

  it("maps price_drop → warning", () => {
    expect(getEventColor("price_drop", colors)).toBe("amber");
  });

  it("maps price_rise → error", () => {
    expect(getEventColor("price_rise", colors)).toBe("red");
  });

  it("falls back to success for unknown types", () => {
    expect(getEventColor("bogus" as never, colors)).toBe("green");
  });
});
