import { describe, expect, it } from "vitest";
import { computeHealthSummary } from "../lib/scrapers/health";
import type { HealthSample } from "../lib/scrapers/health";

function sample(at: string, status: HealthSample["status"] = "working"): HealthSample {
  return { at, status, responseTimeMs: 100 } as HealthSample;
}

describe("computeHealthSummary with invalid dates", () => {
  it("does not throw when a sample has an unparseable date", () => {
    const samples = [
      sample("2026-01-01T00:00:00.000Z"),
      sample("not-a-date"),
      sample("2026-01-03T00:00:00.000Z"),
    ];
    expect(() => computeHealthSummary(samples)).not.toThrow();
    const summary = computeHealthSummary(samples);
    expect(summary.firstAt).toBe("2026-01-01T00:00:00.000Z");
    expect(summary.lastAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("returns null bounds when no sample has a valid date", () => {
    const summary = computeHealthSummary([sample("bad"), sample("also-bad")]);
    expect(summary.firstAt).toBeNull();
    expect(summary.lastAt).toBeNull();
  });
});
