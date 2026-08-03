import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "../lib/last-refreshed";

describe("formatLastRefreshed", () => {
  it("returns 'Never' for undefined input", () => {
    expect(formatLastRefreshed(undefined)).toBe("Never");
  });

  it("returns 'Never' for empty string", () => {
    expect(formatLastRefreshed("")).toBe("Never");
  });

  it("returns 'Just now' for less than 1 minute ago", () => {
    const now = new Date().toISOString();
    expect(formatLastRefreshed(now)).toBe("Just now");
  });

  it("returns minutes ago for < 1 hour", () => {
    const d = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(formatLastRefreshed(d)).toBe("30m ago");
  });

  it("returns hours ago for < 24 hours", () => {
    const d = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(formatLastRefreshed(d)).toBe("3h ago");
  });

  it("returns days ago for < 7 days", () => {
    const d = new Date(Date.now() - 2 * 86400_000).toISOString();
    expect(formatLastRefreshed(d)).toBe("2d ago");
  });

  it("returns formatted date for 7+ days", () => {
    const d = new Date(Date.now() - 10 * 86400_000).toISOString();
    const result = formatLastRefreshed(d);
    // Should contain month name
    expect(result).toMatch(/\w+ \d+/);
  });

  it("returns 'Unknown' for invalid date strings", () => {
    expect(formatLastRefreshed("not-a-date")).toBe("Unknown");
  });
});

describe("getLastRefreshedColor", () => {
  it("returns gray for undefined", () => {
    expect(getLastRefreshedColor(undefined)).toBe("gray");
  });

  it("returns gray for empty string", () => {
    expect(getLastRefreshedColor("")).toBe("gray");
  });

  it("returns green for < 1 hour", () => {
    const d = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(getLastRefreshedColor(d)).toBe("green");
  });

  it("returns yellow for 1-6 hours", () => {
    const d = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(getLastRefreshedColor(d)).toBe("yellow");
  });

  it("returns red for > 6 hours", () => {
    const d = new Date(Date.now() - 8 * 3600_000).toISOString();
    expect(getLastRefreshedColor(d)).toBe("red");
  });

  it("returns red for very old data", () => {
    const d = new Date(Date.now() - 30 * 86400_000).toISOString();
    expect(getLastRefreshedColor(d)).toBe("red");
  });

  it("returns gray for invalid date strings", () => {
    expect(getLastRefreshedColor("not-a-date")).toBe("gray");
  });
});
