import { describe, expect, it } from "vitest";
import { resolveEventRoute, routeForNotification } from "../src/lib/notification-routing";

describe("routeForNotification", () => {
  it("maps product/digest/health/unknown", () => {
    expect(routeForNotification({ productId: "crs804" })).toBe("/product/crs804");
    expect(routeForNotification({ type: "digest" })).toBe("/stats");
    expect(routeForNotification({ type: "health_blocked" })).toBe("/health");
    expect(routeForNotification({})).toBe("/");
  });
});

describe("resolveEventRoute", () => {
  const alerts = [{ id: "a1", productId: "crs804" }];
  const watches = [{ id: "w1", productId: "crs326" }];
  const reminders = [{ id: "r1", productId: "chateau" }];

  it("resolves alertId to the alert's product", () => {
    expect(
      resolveEventRoute({ type: "price_drop", alertId: "a1" }, alerts, watches, reminders),
    ).toBe("/product/crs804");
  });

  it("resolves watchId to the watch's product", () => {
    expect(
      resolveEventRoute({ type: "restock", watchId: "w1" }, alerts, watches, reminders),
    ).toBe("/product/crs326");
  });

  it("resolves reminderId to the reminder's product", () => {
    expect(
      resolveEventRoute({ type: "reminder", reminderId: "r1" }, alerts, watches, reminders),
    ).toBe("/product/chateau");
  });

  it("falls back to routeForNotification for digest and health types", () => {
    expect(resolveEventRoute({ type: "digest" }, alerts, watches, reminders)).toBe("/stats");
    expect(resolveEventRoute({ type: "health_blocked" }, alerts, watches, reminders)).toBe(
      "/health",
    );
  });

  it("uses the event productId when no list entry matches", () => {
    expect(
      resolveEventRoute({ type: "price_drop", productId: "crs804" }, alerts, watches, reminders),
    ).toBe("/product/crs804");
  });

  it("falls back to / for unknown events and stale ids", () => {
    expect(resolveEventRoute({ type: "price_drop", alertId: "gone" }, alerts, watches, reminders)).toBe(
      "/",
    );
    expect(resolveEventRoute({ type: "unknown" }, alerts, watches, reminders)).toBe("/");
  });
});
