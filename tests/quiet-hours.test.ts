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

describe("isInQuietHours with a client utcOffsetMinutes", () => {
  // The server evaluates the window in the user's local time using the offset
  // the client sends (Date.getTimezoneOffset() semantics: minutes to add to
  // local to get UTC), so local = utc - offset. A flipped sign would fire
  // notifications during the user's quiet hours.
  function withOffset(
    start: string,
    end: string,
    utcOffsetMinutes: number,
  ): any {
    return { quietHours: { start, end, utcOffsetMinutes } } as any;
  }

  it("evaluates the window in the user's local time", () => {
    // UTC 02:00 is 22:00 the previous day in UTC-4 (offset 240). A 21:00-07:00
    // window is therefore active.
    const utc2am = new Date(Date.UTC(2026, 0, 2, 2, 0));
    expect(isInQuietHours(withOffset("21:00", "07:00", 240), utc2am)).toBe(true);
    // UTC 18:00 is 14:00 local — outside the window.
    const utc6pm = new Date(Date.UTC(2026, 0, 2, 18, 0));
    expect(isInQuietHours(withOffset("21:00", "07:00", 240), utc6pm)).toBe(false);
  });

  it("handles a positive offset (east of UTC)", () => {
    // UTC 22:00 is 06:00 the next day in UTC+8 (offset -480). A 21:00-07:00
    // window is active.
    const utc10pm = new Date(Date.UTC(2026, 0, 2, 22, 0));
    expect(isInQuietHours(withOffset("21:00", "07:00", -480), utc10pm)).toBe(
      true,
    );
  });

  it("uses the offset for a daytime window too", () => {
    // UTC 20:00 is 12:00 in UTC-8 (offset 480) — inside a 09:00-17:00 window.
    const utc8pm = new Date(Date.UTC(2026, 0, 2, 20, 0));
    expect(isInQuietHours(withOffset("09:00", "17:00", 480), utc8pm)).toBe(true);
    // UTC 02:00 is 18:00 in UTC-8 — outside the same window.
    const utc2am = new Date(Date.UTC(2026, 0, 2, 2, 0));
    expect(isInQuietHours(withOffset("09:00", "17:00", 480), utc2am)).toBe(
      false,
    );
  });
});
