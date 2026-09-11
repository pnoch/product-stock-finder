import { describe, expect, it, vi, afterEach } from "vitest";
import { formatRelativeTime } from "../lib/relative-time";

describe("formatRelativeTime", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("matches mobile thresholds", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
    const t = Date.parse("2026-09-10T12:00:00Z");
    expect(formatRelativeTime(t)).toBe("Just now");
    expect(formatRelativeTime(t - 5 * 60000)).toBe("5m ago");
    expect(formatRelativeTime(t - 3 * 3600000)).toBe("3h ago");
    expect(formatRelativeTime(t - 3 * 86400000)).toBe("3d ago");
    expect(formatRelativeTime(t - 30 * 86400000)).toBe(new Date(t - 30 * 86400000).toLocaleDateString());
  });
  it("clamps future and guards non-finite", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
    const t = Date.parse("2026-09-10T12:00:00Z");
    expect(formatRelativeTime(t + 60000)).toBe("Just now");
    expect(formatRelativeTime(NaN)).toBe("—");
  });
});
