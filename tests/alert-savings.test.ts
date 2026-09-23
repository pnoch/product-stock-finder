import { describe, expect, it } from "vitest";
import { computeTotalSaved, savingAlerts } from "../lib/alert-savings";
import type { PriceAlert } from "../lib/types";

function alert(overrides: Partial<PriceAlert>): PriceAlert {
  return {
    id: "a1",
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as PriceAlert;
}

describe("computeTotalSaved", () => {
  it("sums the drop below target for triggered drop alerts", () => {
    const saved = computeTotalSaved(
      [alert({ targetPrice: 100, triggeredPrice: 80, triggeredAt: "2026-09-02T00:00:00.000Z" })],
      "USD",
    );
    expect(saved).toBe(20);
  });

  // A rise alert fires when the price goes UP; its delta is not a saving.
  // Counting it made the "Total Saved" banner claim money the user never saved.
  it("ignores rise alerts", () => {
    const saved = computeTotalSaved(
      [
        alert({ id: "drop", targetPrice: 100, triggeredPrice: 80, triggeredAt: "2026-09-02T00:00:00.000Z" }),
        alert({ id: "rise", targetPrice: 100, triggeredPrice: 130, direction: "rise", triggeredAt: "2026-09-02T00:00:00.000Z" }),
      ],
      "USD",
    );
    expect(saved).toBe(20);
  });

  it("ignores untriggered alerts and non-positive deltas", () => {
    expect(computeTotalSaved([alert({})], "USD")).toBe(0);
    expect(
      computeTotalSaved(
        [alert({ targetPrice: 100, triggeredPrice: 120, triggeredAt: "2026-09-02T00:00:00.000Z" })],
        "USD",
      ),
    ).toBe(0);
  });

  it("converts to the display currency", () => {
    const saved = computeTotalSaved(
      [alert({ targetPrice: 100, triggeredPrice: 80, currency: "USD", triggeredAt: "2026-09-02T00:00:00.000Z" })],
      "EUR",
    );
    // 20 USD at 0.92 EUR/USD.
    expect(saved).toBeCloseTo(18.4, 5);
  });
});

// The banner's "Across N triggered alerts" count must match the alerts the
// total actually includes, or it counts rise alerts the total excludes.
describe("savingAlerts", () => {
  it("returns only drop alerts with a positive saving", () => {
    const drop = alert({ id: "drop", targetPrice: 100, triggeredPrice: 80, triggeredAt: "2026-09-02T00:00:00.000Z" });
    const rise = alert({ id: "rise", targetPrice: 100, triggeredPrice: 130, direction: "rise", triggeredAt: "2026-09-02T00:00:00.000Z" });
    const untriggered = alert({ id: "none" });
    const noGain = alert({ id: "nogain", targetPrice: 100, triggeredPrice: 120, triggeredAt: "2026-09-02T00:00:00.000Z" });
    expect(savingAlerts([drop, rise, untriggered, noGain]).map((a) => a.id)).toEqual(["drop"]);
  });
});
