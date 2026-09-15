import { describe, expect, it } from "vitest";
import { isInQuietHours } from "../lib/quiet-hours";
import type { AppSettings } from "../lib/types";

function settings(quietHours: AppSettings["quietHours"]): AppSettings {
  return {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
    quietHours,
  };
}

describe("isInQuietHours with utcOffsetMinutes", () => {
  it("evaluates the window in the user's timezone, not the server's", () => {
    // 22:00-07:00 for a UTC-8 user. 06:00 UTC = 22:00 previous day local.
    const qh = { start: "22:00", end: "07:00", utcOffsetMinutes: 480 };
    expect(isInQuietHours(settings(qh), new Date("2026-01-15T06:00:00Z"))).toBe(
      true,
    );
    // 18:00 UTC = 10:00 local — outside the window.
    expect(isInQuietHours(settings(qh), new Date("2026-01-15T18:00:00Z"))).toBe(
      false,
    );
  });

  it("falls back to local time when no offset is provided", () => {
    const qh = { start: "22:00", end: "07:00" };
    const noon = new Date("2026-01-15T12:00:00");
    expect(isInQuietHours(settings(qh), noon)).toBe(false);
  });

  it("handles a positive-offset user (UTC+8)", () => {
    // 22:00-07:00 for UTC+8 (offset = -480). 15:00 UTC = 23:00 local.
    const qh = { start: "22:00", end: "07:00", utcOffsetMinutes: -480 };
    expect(isInQuietHours(settings(qh), new Date("2026-01-15T15:00:00Z"))).toBe(
      true,
    );
    expect(isInQuietHours(settings(qh), new Date("2026-01-15T03:00:00Z"))).toBe(
      false,
    );
  });
});
