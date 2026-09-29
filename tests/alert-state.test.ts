import { describe, expect, it } from "vitest";
import { isAlertActive, countActiveAlerts } from "../lib/alert-state";
import type { PriceAlert } from "../lib/types";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");

function alert(overrides: Partial<PriceAlert>): PriceAlert {
  return {
    id: "a1",
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as PriceAlert;
}

describe("isAlertActive", () => {
  it("counts an enabled, untriggered, unsnoozed alert", () => {
    expect(isAlertActive(alert({}), NOW)).toBe(true);
  });

  it("excludes disabled and triggered alerts", () => {
    expect(isAlertActive(alert({ isActive: false }), NOW)).toBe(false);
    expect(isAlertActive(alert({ triggeredAt: "2026-09-02T00:00:00.000Z" }), NOW)).toBe(false);
  });

  // The Home stat card, the Alerts tab badge, and the tab counter must agree:
  // a snoozed alert is not currently armed.
  it("excludes an alert whose snooze has not elapsed", () => {
    expect(isAlertActive(alert({ snoozedUntil: "2026-09-30T00:00:00.000Z" }), NOW)).toBe(false);
  });

  it("includes an alert whose snooze has elapsed", () => {
    expect(isAlertActive(alert({ snoozedUntil: "2026-09-20T00:00:00.000Z" }), NOW)).toBe(true);
  });

  it("treats a snooze expiring exactly now as elapsed", () => {
    // The guard is `until > now`, so at exactly `now` the alert is active
    // again (a `>=` would keep it snoozed one instant too long).
    expect(
      isAlertActive(alert({ snoozedUntil: "2026-09-23T12:00:00.000Z" }), NOW),
    ).toBe(true);
  });

  it("counts only active alerts", () => {
    const alerts = [
      alert({ id: "active" }),
      alert({ id: "disabled", isActive: false }),
      alert({ id: "triggered", triggeredAt: "2026-09-02T00:00:00.000Z" }),
      alert({ id: "snoozed", snoozedUntil: "2026-09-30T00:00:00.000Z" }),
    ];
    expect(countActiveAlerts(alerts, NOW)).toBe(1);
  });
});
