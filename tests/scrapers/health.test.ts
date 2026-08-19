import { describe, it, expect } from "vitest";
import {
  classifyResult,
  computeHealthStats,
  createHealthService,
  pruneHealthHistory,
} from "@/lib/scrapers/health";
import type {
  HealthHistory,
  HealthSample,
  HealthStatus,
} from "@/lib/scrapers/health";
import { BLOCKED_MARKERS } from "@/lib/scrapers/resilient";

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
    expect(pruneHealthHistory(samples, now)).toEqual([sample(10), sample(29)]);
  });

  it("caps at 90 samples, keeping the newest", () => {
    const samples: HealthSample[] = Array.from({ length: 100 }, (_, i) => ({
      status: "working",
      at: new Date(now - (99 - i) * 60 * 1000).toISOString(),
    }));
    const pruned = pruneHealthHistory(samples, now);
    expect(pruned).toHaveLength(90);
    expect(pruned[0]).toEqual(samples[10]);
    expect(pruned[89]).toEqual(samples[99]);
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
