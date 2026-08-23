import { describe, expect, it } from "vitest";
import {
  formatLastSeen,
  platformLabel,
} from "../components/settings/device-management/device-utils";

describe("platformLabel", () => {
  it("maps known platforms", () => {
    expect(platformLabel("ios")).toBe("iOS");
    expect(platformLabel("android")).toBe("Android");
  });

  it("falls back to Unknown", () => {
    expect(platformLabel(null)).toBe("Unknown");
    expect(platformLabel("web")).toBe("Unknown");
  });
});

describe("formatLastSeen", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");

  it("reports unknown timestamps", () => {
    expect(formatLastSeen(0, now)).toBe("last seen unknown");
  });

  it("reports recent timestamps as just now", () => {
    expect(formatLastSeen(now - 30_000, now)).toBe("last seen just now");
  });

  it("reports minutes", () => {
    expect(formatLastSeen(now - 5 * 60_000, now)).toBe("last seen 5m ago");
    expect(formatLastSeen(now - 59 * 60_000, now)).toBe("last seen 59m ago");
  });

  it("reports hours", () => {
    expect(formatLastSeen(now - 60 * 60_000, now)).toBe("last seen 1h ago");
    expect(formatLastSeen(now - 23 * 60 * 60_000, now)).toBe(
      "last seen 23h ago",
    );
  });

  it("reports days", () => {
    expect(formatLastSeen(now - 24 * 60 * 60_000, now)).toBe(
      "last seen 1d ago",
    );
    expect(formatLastSeen(now - 3 * 24 * 60 * 60_000, now)).toBe(
      "last seen 3d ago",
    );
  });
});
