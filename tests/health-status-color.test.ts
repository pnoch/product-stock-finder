import { describe, expect, it } from "vitest";
import { healthStatusColor } from "@/lib/health-status";

const colors = { success: "#0a0", warning: "#fa0", error: "#f00" };

describe("healthStatusColor", () => {
  it("maps working/blocked/error to success/warning/error", () => {
    expect(healthStatusColor("working", undefined, colors)).toBe(colors.success);
    expect(healthStatusColor("blocked", undefined, colors)).toBe(colors.warning);
    expect(healthStatusColor("error", "no price found", colors)).toBe(colors.error);
  });

  it("renders an error whose reason names a block as a warning", () => {
    expect(healthStatusColor("error", "403 Forbidden", colors)).toBe(colors.warning);
    expect(healthStatusColor("error", "Access Denied", colors)).toBe(colors.warning);
  });
});
