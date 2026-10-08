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

  // The restock notification carries distributorId/url, so a tap must open the
  // product with the in-stock store highlighted instead of dropping the store.
  it("highlights the store when distributorId is present", () => {
    expect(
      notificationRouteFor({
        productId: "p1",
        distributorId: "getic-gr",
        type: "stock_alert",
      }),
    ).toBe("/product/p1?distributor=getic-gr");
  });
});
