import { describe, it, expect } from "vitest";
import { isInQuietHours } from "@/lib/quiet-hours";

function settings(start?: string, end?: string): any {
  return { quietHours: { start, end } } as any;
}

function at(h: number, m = 0): Date {
  return new Date(2026, 0, 1, h, m);
}

describe("isInQuietHours", () => {
  it("returns false when quietHours is undefined", () => {
    expect(isInQuietHours({} as any, at(23, 0))).toBe(false);
  });

  it("returns false when start or end is missing", () => {
    expect(isInQuietHours({ quietHours: undefined } as any, at(23, 0))).toBe(false);
    expect(isInQuietHours(settings(undefined, "07:00"), at(23, 0))).toBe(false);
    expect(isInQuietHours(settings("22:00", undefined), at(23, 0))).toBe(false);
    expect(isInQuietHours(settings("", "07:00"), at(23, 0))).toBe(false);
    expect(isInQuietHours(settings("22:00", ""), at(23, 0))).toBe(false);
  });

  it("returns false for invalid time formats", () => {
    expect(isInQuietHours(settings("25:00", "07:00"), at(23, 0))).toBe(false);
    expect(isInQuietHours(settings("22:00", "9pm"), at(23, 0))).toBe(false);
    expect(isInQuietHours(settings("9:00", "17:00"), at(10, 0))).toBe(false);
    expect(isInQuietHours(settings("22:00", "24:00"), at(23, 0))).toBe(false);
    expect(isInQuietHours(settings("22:00", "07:60"), at(23, 0))).toBe(false);
  });

  it("returns false when start equals end", () => {
    expect(isInQuietHours(settings("22:00", "22:00"), at(22, 0))).toBe(false);
    expect(isInQuietHours(settings("09:00", "09:00"), at(9, 0))).toBe(false);
  });

  it("handles a daytime window with inclusive start and exclusive end", () => {
    const s = settings("09:00", "17:00");
    expect(isInQuietHours(s, at(12, 0))).toBe(true);
    expect(isInQuietHours(s, at(8, 59))).toBe(false);
    expect(isInQuietHours(s, at(17, 1))).toBe(false);
    expect(isInQuietHours(s, at(9, 0))).toBe(true);
    expect(isInQuietHours(s, at(17, 0))).toBe(false);
  });

  it("handles an overnight window that wraps past midnight", () => {
    const s = settings("22:00", "07:00");
    expect(isInQuietHours(s, at(23, 0))).toBe(true);
    expect(isInQuietHours(s, at(3, 0))).toBe(true);
    expect(isInQuietHours(s, at(12, 0))).toBe(false);
    expect(isInQuietHours(s, at(22, 0))).toBe(true);
    expect(isInQuietHours(s, at(7, 0))).toBe(false);
  });

  it("uses the now param rather than the wall clock", () => {
    const s = settings("22:00", "07:00");
    expect(isInQuietHours(s, at(23, 0))).toBe(true);
    expect(isInQuietHours(s, at(12, 0))).toBe(false);
  });
});
