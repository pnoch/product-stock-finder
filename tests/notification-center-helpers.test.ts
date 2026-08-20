import { describe, expect, it } from "vitest";
import { healthColor, healthIcon } from "../lib/notification-center-helpers";

describe("healthIcon", () => {
  it("returns checkmark for recovered", () => {
    expect(healthIcon("recovered")).toBe("checkmark.circle.fill");
  });

  it("returns warning triangle for blocked", () => {
    expect(healthIcon("blocked")).toBe("exclamationmark.triangle.fill");
  });

  it("returns warning triangle for error", () => {
    expect(healthIcon("error")).toBe("exclamationmark.triangle.fill");
  });

  it("returns warning triangle when status is undefined", () => {
    expect(healthIcon(undefined)).toBe("exclamationmark.triangle.fill");
  });
});

describe("healthColor", () => {
  it("returns success for recovered", () => {
    expect(healthColor("recovered")).toBe("success");
  });

  it("returns warning for blocked", () => {
    expect(healthColor("blocked")).toBe("warning");
  });

  it("returns warning for error", () => {
    expect(healthColor("error")).toBe("warning");
  });

  it("returns warning when status is undefined", () => {
    expect(healthColor(undefined)).toBe("warning");
  });
});
