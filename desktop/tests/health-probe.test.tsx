import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockStorage = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getPendingHealthEvents: vi.fn(),
  savePendingHealthEvents: vi.fn(),
  recordNotificationEvent: vi.fn(),
}));
vi.mock("../src/storage", () => ({ storage: mockStorage }));

vi.mock("../src/notifications", () => ({
  sendDesktopNotification: vi.fn(),
}));

const mockHealthQuery = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({ health: { check: { query: mockHealthQuery } } }),
}));

const mockSvc = vi.hoisted(() => ({
  saveDistributorHealth: vi.fn(),
  getHealthHistory: vi.fn(),
  recordSample: vi.fn(),
}));
vi.mock("../../lib/scrapers/health", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/scrapers/health")>();
  return { ...actual, createHealthService: vi.fn(() => mockSvc) };
});

import { runHealthProbeIfDue } from "../src/lib/health-probe";
import { sendDesktopNotification } from "../src/notifications";

const LAST_PROBE_KEY = "last_health_probe_at";

function baseSettings(overrides: Record<string, unknown> = {}) {
  return {
    notificationsEnabled: true,
    healthAlerts: true,
    checkInterval: "hourly",
    ...overrides,
  };
}

function sample(status: string, at = new Date().toISOString()) {
  return { status, at };
}

function probeResult(
  distributorId = "server2u-my",
  status = "blocked",
  extra: Record<string, unknown> = {},
) {
  return [
    {
      distributorId,
      status,
      reason: "captcha",
      responseTimeMs: 100,
      lastChecked: new Date().toISOString(),
      ...extra,
    },
  ];
}

function quietHoursCoveringNow(): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return {
    start: fmt(new Date(now.getTime() - 30 * 60_000)),
    end: fmt(new Date(now.getTime() + 30 * 60_000)),
  };
}

describe("runHealthProbeIfDue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockStorage.getSettings.mockResolvedValue(baseSettings());
    mockStorage.getPendingHealthEvents.mockResolvedValue([]);
    mockStorage.savePendingHealthEvents.mockResolvedValue(undefined);
    mockStorage.recordNotificationEvent.mockResolvedValue(undefined);
    mockSvc.getHealthHistory.mockResolvedValue({});
    mockSvc.saveDistributorHealth.mockResolvedValue(undefined);
    mockSvc.recordSample.mockResolvedValue(undefined);
    mockHealthQuery.mockRejectedValue(new Error("tRPC unreachable"));
  });

  it("skips the probe when checkInterval is manual", async () => {
    mockStorage.getSettings.mockResolvedValue(baseSettings({ checkInterval: "manual" }));
    await runHealthProbeIfDue(1_000_000);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockHealthQuery).not.toHaveBeenCalled();
    expect(localStorage.getItem(LAST_PROBE_KEY)).toBeNull();
  });

  it("skips the probe when health alerts are disabled", async () => {
    mockStorage.getSettings.mockResolvedValue(baseSettings({ healthAlerts: false }));
    await runHealthProbeIfDue(1_000_000);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockHealthQuery).not.toHaveBeenCalled();
  });

  it("probes during quiet hours but suppresses notifications", async () => {
    mockStorage.getSettings.mockResolvedValue(
      baseSettings({ quietHours: quietHoursCoveringNow() }),
    );
    const results = probeResult();
    mockInvoke.mockResolvedValue(results);
    mockSvc.getHealthHistory.mockResolvedValue({
      "server2u-my": [
        sample("working"),
        sample("blocked"),
        sample("blocked"),
        sample("blocked"),
      ],
    });
    await runHealthProbeIfDue(10_000_000);
    expect(mockInvoke).toHaveBeenCalledWith("check_distributor_health");
    expect(mockSvc.saveDistributorHealth).toHaveBeenCalledWith(results);
    expect(sendDesktopNotification).not.toHaveBeenCalled();
    expect(mockStorage.savePendingHealthEvents).not.toHaveBeenCalled();
    expect(mockStorage.recordNotificationEvent).not.toHaveBeenCalled();
  });

  it("fires a blocked alert on working→blocked×3 transition", async () => {
    const results = probeResult();
    mockInvoke.mockResolvedValue(results);
    mockSvc.getHealthHistory.mockResolvedValue({
      "server2u-my": [
        sample("working"),
        sample("blocked"),
        sample("blocked"),
        sample("blocked"),
      ],
    });
    const now = 2_000_000_000;
    await runHealthProbeIfDue(now);
    expect(mockSvc.saveDistributorHealth).toHaveBeenCalledWith(results);
    expect(mockSvc.recordSample).toHaveBeenCalledWith(
      "server2u-my",
      "blocked",
      "captcha",
      100,
    );
    expect(sendDesktopNotification).toHaveBeenCalledWith(
      "🟠 Distributor Blocked",
      expect.stringContaining("has been blocked for 3 consecutive probes"),
    );
    expect(mockStorage.recordNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "health", title: "🟠 Distributor Blocked" }),
    );
    expect(mockStorage.savePendingHealthEvents).toHaveBeenCalled();
    expect(localStorage.getItem(LAST_PROBE_KEY)).toBe(String(now));
  });

  it("does not notify on steady blocked history (no transition)", async () => {
    mockInvoke.mockResolvedValue(probeResult());
    mockSvc.getHealthHistory.mockResolvedValue({
      "server2u-my": [
        sample("blocked"),
        sample("blocked"),
        sample("blocked"),
        sample("blocked"),
      ],
    });
    await runHealthProbeIfDue(10_000_000);
    expect(mockInvoke).toHaveBeenCalled();
    expect(sendDesktopNotification).not.toHaveBeenCalled();
    expect(mockStorage.savePendingHealthEvents).not.toHaveBeenCalled();
    expect(mockStorage.recordNotificationEvent).not.toHaveBeenCalled();
  });

  it("fires a recovery notification on blocked×3→working", async () => {
    mockInvoke.mockResolvedValue(probeResult("server2u-my", "working"));
    mockSvc.getHealthHistory.mockResolvedValue({
      "server2u-my": [
        sample("blocked"),
        sample("blocked"),
        sample("blocked"),
        sample("working"),
      ],
    });
    await runHealthProbeIfDue(10_000_000);
    expect(sendDesktopNotification).toHaveBeenCalledWith(
      "🟢 Distributor Recovered",
      expect.stringContaining("is back online after being blocked"),
    );
    expect(mockStorage.recordNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "health", title: "🟢 Distributor Recovered" }),
    );
  });

  it("never throws and does not stamp the clock when probing fails", async () => {
    mockInvoke.mockRejectedValue(new Error("no tauri"));
    mockHealthQuery.mockRejectedValue(new Error("server down"));
    await expect(runHealthProbeIfDue(10_000_000)).resolves.toBeUndefined();
    expect(localStorage.getItem(LAST_PROBE_KEY)).toBeNull();
    expect(sendDesktopNotification).not.toHaveBeenCalled();
  });

  it("batches two distributors into one queue save", async () => {
    mockInvoke.mockResolvedValue([
      ...probeResult("dist-a", "blocked"),
      ...probeResult("dist-b", "blocked"),
    ]);
    mockSvc.getHealthHistory.mockResolvedValue({
      "dist-a": [
        sample("working"),
        sample("blocked"),
        sample("blocked"),
        sample("blocked"),
      ],
      "dist-b": [
        sample("working"),
        sample("blocked"),
        sample("blocked"),
        sample("blocked"),
      ],
    });
    await runHealthProbeIfDue(10_000_000);
    expect(sendDesktopNotification).toHaveBeenCalledTimes(2);
    expect(mockStorage.savePendingHealthEvents).toHaveBeenCalledTimes(1);
    expect(mockStorage.savePendingHealthEvents.mock.calls[0][0]).toHaveLength(2);
  });
});
