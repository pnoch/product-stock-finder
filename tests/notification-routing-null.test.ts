import { describe, expect, it } from "vitest";
import { notificationRouteFor } from "../lib/notification-routing";

describe("notificationRouteFor tolerates a missing data payload", () => {
  it("returns null for undefined/null data instead of throwing", () => {
    expect(notificationRouteFor(undefined)).toBeNull();
    expect(notificationRouteFor(null)).toBeNull();
  });

  it("still routes a product notification", () => {
    expect(notificationRouteFor({ productId: "p1" })).toBe("/product/p1");
  });

  it("routes digest and health notifications", () => {
    expect(notificationRouteFor({ type: "digest" })).toBe("/stats");
    expect(notificationRouteFor({ type: "health_alert" })).toBe("/health");
  });

  it("returns null for an unrecognized type", () => {
    expect(notificationRouteFor({ type: "other" })).toBeNull();
  });
});
