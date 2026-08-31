import { describe, it, expect, vi } from "vitest";
import {
  classifyProbeOutcome,
  classifyResult,
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  detectHealthAlert,
  detectHealthRecovery,
  groupSamplesByDay,
  pruneHealthHistory,
  timelineSegments,
} from "@/lib/scrapers/health";
import type {
  HealthHistory,
  HealthSample,
  HealthStatus,
} from "@/lib/scrapers/health";
import type { DistributorParser, ScrapeResult } from "@/lib/scrapers/types";
import { BLOCKED_MARKERS, resilientFetch } from "@/lib/scrapers/resilient";

vi.mock("@/lib/scrapers/resilient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/scrapers/resilient")>();
  return {
    ...actual,
    resilientFetch: vi.fn(async () => ({
      status: "ok",
      method: "plain",
      html: "<html>Access Denied</html>",
    })),
  };
});

describe("classifyResult", () => {
  it("returns working when result has a price", () => {
    const result = {
      price: 100,
      currency: "USD",
      stockStatus: "in_stock" as const,
      url: "x",
    };
    expect(classifyResult("<html></html>", result)).toBe("working");
  });

  it("returns blocked when HTML contains 403 Forbidden", () => {
    expect(classifyResult("403 Forbidden", null)).toBe("blocked");
  });

  it("returns blocked when HTML contains Access Denied", () => {
    expect(classifyResult("Access Denied", null)).toBe("blocked");
  });

  it("returns blocked when HTML contains Cloudflare challenge", () => {
    expect(classifyResult("cf-browser-verification", null)).toBe("blocked");
  });

  it("returns error when result is null and no block detected", () => {
    expect(classifyResult("<html>no products</html>", null)).toBe("error");
  });

  it("returns error when an error is thrown", () => {
    expect(classifyResult("", null, new Error("connection refused"))).toBe(
      "error",
    );
  });

  it("returns blocked even when result has a price (blocked wins)", () => {
    const result = {
      price: 100,
      currency: "USD",
      stockStatus: "in_stock" as const,
      url: "x",
    };
    expect(classifyResult("Access Denied", result)).toBe("blocked");
  });

  it("detects every marker from the single source of truth", () => {
    for (const marker of BLOCKED_MARKERS) {
      expect(classifyResult(marker, null)).toBe("blocked");
    }
  });
});

function createMockAdapter() {
  const store = new Map<string, string>();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  };
}

describe("createHealthService", () => {
  it("saves and loads health", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    const health = [
      {
        distributorId: "server2u-my",
        status: "working" as const,
        lastChecked: new Date().toISOString(),
      },
    ];
    await service.saveDistributorHealth(health);
    const loaded = await service.getDistributorHealth();
    expect(loaded).toEqual(health);
  });

  it("returns empty array when nothing stored", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    expect(await service.getDistributorHealth()).toEqual([]);
  });

  it("returns empty array when stored data is corrupt", async () => {
    const adapter = createMockAdapter();
    await adapter.setItem("distributor_health", "not json");
    const service = createHealthService(adapter);
    expect(await service.getDistributorHealth()).toEqual([]);
  });

  it("testAllDistributors records history samples", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    const results = await service.testAllDistributors();
    const history = await service.getHealthHistory();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const samples = history[r.distributorId];
      expect(samples).toBeDefined();
      expect(samples[samples.length - 1].status).toBe(r.status);
    }
  });

  it("testAllDistributors records blocked status for blocked outcome", async () => {
    vi.mocked(resilientFetch).mockImplementation(async () => ({
      status: "blocked",
      method: "plain",
      error: "403 Forbidden",
    }));
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    const results = await service.testAllDistributors();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.status === "blocked")).toBe(true);
    const history = await service.getHealthHistory();
    for (const r of results) {
      const samples = history[r.distributorId];
      expect(samples).toBeDefined();
      expect(samples[samples.length - 1].status).toBe("blocked");
    }
  });
});

describe("health history", () => {
  it("getHealthHistory returns empty object when nothing stored", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    expect(await service.getHealthHistory()).toEqual({});
  });

  it("getHealthHistory returns empty object when stored data is corrupt", async () => {
    const adapter = createMockAdapter();
    await adapter.setItem("distributor_health_history", "not json");
    const service = createHealthService(adapter);
    expect(await service.getHealthHistory()).toEqual({});
  });

  it("recordSample appends a sample and persists it", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    await service.recordSample("server2u-my", "working");
    const history = await service.getHealthHistory();
    expect(history["server2u-my"]).toHaveLength(1);
    expect(history["server2u-my"][0].status).toBe("working");
    expect(typeof history["server2u-my"][0].at).toBe("string");
  });

  it("recordSample keeps samples from multiple distributors separate", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    await service.recordSample("server2u-my", "working");
    await service.recordSample("linitx-uk", "blocked");
    const history = await service.getHealthHistory();
    expect(history["server2u-my"]).toHaveLength(1);
    expect(history["linitx-uk"]).toHaveLength(1);
    expect(history["linitx-uk"][0].status).toBe("blocked");
  });
});

describe("pruneHealthHistory", () => {
  const now = new Date("2026-08-19T12:00:00Z").getTime();

  function sample(daysAgo: number, status: HealthStatus = "working"): HealthSample {
    return {
      status,
      at: new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  it("drops samples older than 30 days", () => {
    const samples = [sample(31), sample(10), sample(29)];
    expect(pruneHealthHistory(samples, now)).toEqual([sample(29), sample(10)]);
  });

  it("caps at 720 samples, keeping the newest", () => {
    const samples: HealthSample[] = Array.from({ length: 800 }, (_, i) => ({
      status: "working",
      at: new Date(now - (799 - i) * 60 * 1000).toISOString(),
    }));
    const pruned = pruneHealthHistory(samples, now);
    expect(pruned).toHaveLength(720);
    expect(pruned[0]).toEqual(samples[80]);
    expect(pruned[719]).toEqual(samples[799]);
  });

  it("returns an empty array when everything is stale", () => {
    expect(pruneHealthHistory([sample(31), sample(40)], now)).toEqual([]);
  });
});

describe("computeHealthStats", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("computes uptime percentage", () => {
    const history: HealthHistory = {
      d1: [
        sample("working", "2026-08-01"),
        sample("working", "2026-08-02"),
        sample("error", "2026-08-03"),
      ],
    };
    expect(computeHealthStats(history).d1.uptimePct).toBe(67);
  });

  it("trend is up when recent half improves by >=10pp", () => {
    const history: HealthHistory = {
      d1: [
        sample("error", "2026-08-01"),
        sample("error", "2026-08-02"),
        sample("error", "2026-08-03"),
        sample("error", "2026-08-04"),
        sample("working", "2026-08-05"),
        sample("working", "2026-08-06"),
      ],
    };
    expect(computeHealthStats(history).d1.trend).toBe("up");
  });

  it("trend is down when recent half declines by >=10pp", () => {
    const history: HealthHistory = {
      d1: [
        sample("working", "2026-08-01"),
        sample("working", "2026-08-02"),
        sample("working", "2026-08-03"),
        sample("working", "2026-08-04"),
        sample("error", "2026-08-05"),
        sample("error", "2026-08-06"),
      ],
    };
    expect(computeHealthStats(history).d1.trend).toBe("down");
  });

  it("trend is flat within the 10pp threshold", () => {
    const history: HealthHistory = {
      d1: [
        sample("working", "2026-08-01"),
        sample("error", "2026-08-02"),
        sample("working", "2026-08-03"),
        sample("error", "2026-08-04"),
      ],
    };
    expect(computeHealthStats(history).d1.trend).toBe("flat");
  });

  it("sparkline maps statuses to numeric values and truncates to last 30", () => {
    const samples: HealthSample[] = Array.from({ length: 35 }, (_, i) =>
      sample(
        i % 3 === 0 ? "working" : i % 3 === 1 ? "blocked" : "error",
        `2026-08-${String(i + 1).padStart(2, "0")}`,
      ),
    );
    const stats = computeHealthStats({ d1: samples }).d1;
    expect(stats.sparkline).toHaveLength(30);
    expect(stats.sparkline).toContain(1);
    expect(stats.sparkline).toContain(0.5);
    expect(stats.sparkline).toContain(0);
  });

  it("skips distributors with no samples", () => {
    expect(computeHealthStats({ d1: [] })).toEqual({});
  });
});

describe("classifyProbeOutcome", () => {
  function mockParser(
    parsePrice: (html: string) => ScrapeResult | null,
  ): DistributorParser {
    return {
      id: "test-parser",
      baseUrl: "https://example.com",
      buildSearchUrl: () => "https://example.com/search?q=CRS326",
      parsePrice,
      rateLimitMs: 0,
    };
  }

  const workingParser = mockParser(() => ({
    price: 100,
    currency: "USD",
    stockStatus: "in_stock" as const,
    url: "x",
  }));

  it("maps ok outcome with a price to working", () => {
    expect(
      classifyProbeOutcome(
        { status: "ok", method: "plain", html: "<html></html>" },
        workingParser,
      ),
    ).toEqual({ status: "working" });
  });

  it("maps ok outcome without a price to error", () => {
    expect(
      classifyProbeOutcome(
        { status: "ok", method: "plain", html: "<html></html>" },
        mockParser(() => null),
      ),
    ).toEqual({ status: "error", reason: "no price found" });
  });

  it("maps blocked outcome to blocked", () => {
    expect(
      classifyProbeOutcome(
        { status: "blocked", method: "plain", error: "403 Forbidden" },
        workingParser,
      ),
    ).toEqual({ status: "blocked", reason: "403 Forbidden" });
  });

  it("maps skipped outcome to blocked with cooldown reason", () => {
    expect(
      classifyProbeOutcome({ status: "skipped", method: "none" }, workingParser),
    ).toEqual({ status: "blocked", reason: "in cooldown" });
  });

  it("maps error outcome to error", () => {
    expect(
      classifyProbeOutcome(
        { status: "error", method: "plain", error: "timeout" },
        workingParser,
      ),
    ).toEqual({ status: "error", reason: "timeout" });
  });
});

describe("computeHealthSummary", () => {
  function sample(
    status: HealthStatus,
    at: string,
    responseTimeMs?: number,
  ): HealthSample {
    return { status, at, responseTimeMs };
  }

  it("returns zeroed summary for empty samples", () => {
    expect(computeHealthSummary([])).toEqual({
      count: 0,
      firstAt: null,
      lastAt: null,
      avgResponseTimeMs: null,
    });
  });

  it("counts samples", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-02T00:00:00Z"),
      sample("blocked", "2026-08-03T00:00:00Z"),
    ];
    expect(computeHealthSummary(samples).count).toBe(3);
  });

  it("firstAt and lastAt are the oldest and newest samples", () => {
    const samples = [
      sample("working", "2026-08-02T00:00:00Z"),
      sample("error", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-03T00:00:00Z"),
    ];
    const summary = computeHealthSummary(samples);
    expect(summary.firstAt).toBe("2026-08-01T00:00:00Z");
    expect(summary.lastAt).toBe("2026-08-03T00:00:00Z");
  });

  it("averages response time over samples that have it", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z", 100),
      sample("working", "2026-08-02T00:00:00Z", 300),
      sample("working", "2026-08-03T00:00:00Z"),
    ];
    expect(computeHealthSummary(samples).avgResponseTimeMs).toBe(200);
  });

  it("returns null avg response time when no sample has it", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("working", "2026-08-02T00:00:00Z"),
    ];
    expect(computeHealthSummary(samples).avgResponseTimeMs).toBeNull();
  });
});

describe("timelineSegments", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns empty for no samples", () => {
    expect(timelineSegments([])).toEqual([]);
  });

  it("single sample has full weight", () => {
    expect(
      timelineSegments([sample("working", "2026-08-01T00:00:00Z")]),
    ).toEqual([{ status: "working", weight: 1 }]);
  });

  it("weights are proportional to time gaps", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
    ]);
    // spans: 1h, 2h -> total 3h + last 2h = 5h -> weights 0.2, 0.4, 0.4 (last visible)
    expect(segments[0].weight).toBeCloseTo(0.2, 5);
    expect(segments[1].weight).toBeCloseTo(0.4, 5);
    expect(segments[2].weight).toBeCloseTo(0.4, 5);
  });

  it("last segment reuses the previous span", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T01:00:00Z"),
    ]);
    // spans: 1h -> total 1h + last 1h = 2h -> weights 0.5, 0.5 (last visible)
    expect(segments[0].weight).toBeCloseTo(0.5, 5);
    expect(segments[1].weight).toBeCloseTo(0.5, 5);
  });

  it("equal weights when all timestamps identical", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T00:00:00Z"),
    ]);
    expect(segments.map((s) => s.weight)).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("weights sum to 1", () => {
    const segments = timelineSegments([
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T05:00:00Z"),
    ]);
    const total = segments.reduce((sum, s) => sum + s.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("groupSamplesByDay", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns empty for no samples", () => {
    expect(groupSamplesByDay([])).toEqual([]);
  });

  it("groups samples by local day", () => {
    const groups = groupSamplesByDay([
      sample("working", "2026-08-19T12:00:00Z"),
      sample("blocked", "2026-08-20T12:00:00Z"),
      sample("error", "2026-08-19T14:00:00Z"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].day).toBe("2026-08-20");
    expect(groups[1].day).toBe("2026-08-19");
    expect(groups[1].samples).toHaveLength(2);
  });

  it("sorts newest day first", () => {
    const days = groupSamplesByDay([
      sample("working", "2026-08-19T12:00:00Z"),
      sample("working", "2026-08-21T12:00:00Z"),
      sample("working", "2026-08-20T12:00:00Z"),
    ]).map((g) => g.day);
    expect(days).toEqual(["2026-08-21", "2026-08-20", "2026-08-19"]);
  });

  it("sorts samples newest-first within a day", () => {
    const group = groupSamplesByDay([
      sample("working", "2026-08-19T12:00:00Z"),
      sample("blocked", "2026-08-19T14:00:00Z"),
      sample("error", "2026-08-19T10:00:00Z"),
    ])[0];
    expect(group.samples.map((s) => s.at)).toEqual([
      "2026-08-19T14:00:00Z",
      "2026-08-19T12:00:00Z",
      "2026-08-19T10:00:00Z",
    ]);
  });
});

describe("detectHealthAlert", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns false with fewer than threshold + 1 samples", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(false);
  });

  it("returns true when exactly 3 consecutive non-working follow a working sample", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("blocked", "2026-08-01T03:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(true);
  });

  it("returns false when the streak is longer than threshold (no re-fire)", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("error", "2026-08-01T04:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(false);
  });

  it("returns true again after recovery and a new outage", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T04:00:00Z"),
      sample("blocked", "2026-08-01T05:00:00Z"),
      sample("error", "2026-08-01T06:00:00Z"),
      sample("blocked", "2026-08-01T07:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(true);
  });

  it("respects a custom threshold", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthAlert(samples, 2)).toBe(true);
    expect(detectHealthAlert(samples, 3)).toBe(false);
  });
});

describe("detectHealthRecovery", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns false with fewer than threshold + 1 samples", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("working", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("returns true when last working follows exactly 3 non-working", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("working", "2026-08-01T03:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(true);
  });

  it("returns true when last working follows a longer streak (4+ non-working)", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T04:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(true);
  });

  it("returns false when last sample is non-working", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("returns false when the preceding streak is shorter than threshold (blip)", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("working", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("does not re-fire on consecutive working samples", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("working", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T04:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("respects a custom threshold", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("working", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthRecovery(samples, 2)).toBe(true);
    expect(detectHealthRecovery(samples, 3)).toBe(false);
  });
});
