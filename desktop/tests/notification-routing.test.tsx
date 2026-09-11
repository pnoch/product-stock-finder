import { describe, expect, it } from "vitest";
import { routeForNotification } from "../src/lib/notification-routing";

describe("routeForNotification", () => {
  it("maps product/digest/health/unknown", () => {
    expect(routeForNotification({ productId: "crs804" })).toBe("/product/crs804");
    expect(routeForNotification({ type: "digest" })).toBe("/stats");
    expect(routeForNotification({ type: "health_blocked" })).toBe("/health");
    expect(routeForNotification({})).toBe("/");
  });
});
