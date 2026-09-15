import { describe, expect, it } from "vitest";
import { rowToConfig } from "../server/notifications/mappers";

describe("rowToConfig preserves quiet-hours offset", () => {
  it("keeps utcOffsetMinutes from the stored JSON", () => {
    const config = rowToConfig({
      alerts: [],
      stockWatches: [],
      dateReminders: [],
      quietHours: { start: "22:00", end: "07:00", utcOffsetMinutes: 480 },
    });
    expect(config.quietHours).toEqual({
      start: "22:00",
      end: "07:00",
      utcOffsetMinutes: 480,
    });
  });

  it("omits the offset when absent", () => {
    const config = rowToConfig({
      alerts: [],
      stockWatches: [],
      dateReminders: [],
      quietHours: { start: "22:00", end: "07:00" },
    });
    expect(config.quietHours).toEqual({ start: "22:00", end: "07:00" });
  });
});
