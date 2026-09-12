import { describe, expect, it } from "vitest";
import { notificationRouteFor } from "../lib/notification-routing";

describe("notificationRouteFor", () => {
  it("maps product/digest/health, null otherwise", () => {
    expect(notificationRouteFor({ productId: "crs804" })).toBe("/product/crs804");
    expect(notificationRouteFor({ type: "digest" })).toBe("/stats");
    expect(notificationRouteFor({ type: "health_blocked" })).toBe("/health");
    expect(notificationRouteFor({})).toBeNull();
    expect(notificationRouteFor({ type: "unknown-thing" })).toBeNull();
  });
});
