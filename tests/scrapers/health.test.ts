import { describe, it, expect } from "vitest";
import { classifyResult, createHealthService } from "@/lib/scrapers/health";
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
