import { describe, expect, it } from "vitest";
import { assessMonitoringHealth } from "../lib/monitoring-health";

const HOUR = 60 * 60 * 1000;
const base = { enabled: true, registered: true, lastRunAt: 0, intervalMs: HOUR, now: 10 * HOUR };

describe("assessMonitoringHealth", () => {
  it("is off when disabled", () => {
    expect(assessMonitoringHealth({ ...base, enabled: false }).status).toBe("off");
  });

  it("is stopped when enabled but unregistered", () => {
    expect(assessMonitoringHealth({ ...base, registered: false }).status).toBe("stopped");
  });

  it("is ok when registered but never run", () => {
    expect(assessMonitoringHealth({ ...base, lastRunAt: null }).status).toBe("ok");
  });

  it("is stale past 2x the interval", () => {
    const r = assessMonitoringHealth({ ...base, lastRunAt: 10 * HOUR - 2 * HOUR - 1 });
    expect(r.status).toBe("stale");
  });

  it("is ok within 2x the interval", () => {
    expect(assessMonitoringHealth({ ...base, lastRunAt: 10 * HOUR - HOUR }).status).toBe("ok");
  });

  it("is ok exactly at 2x the interval (boundary)", () => {
    expect(assessMonitoringHealth({ ...base, lastRunAt: 10 * HOUR - 2 * HOUR }).status).toBe("ok");
  });
});
