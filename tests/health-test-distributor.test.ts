import { describe, expect, it, vi } from "vitest";
import { createHealthService } from "@/lib/scrapers/health";

function memAdapter() {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.set(k, v),
    removeItem: async (k: string) => void m.delete(k),
  } as never;
}

describe("HealthService.testDistributor", () => {
  it("returns null for an unknown parser id", async () => {
    const svc = createHealthService(memAdapter());
    await expect(svc.testDistributor("nope")).resolves.toBeNull();
  });

  it("records a sample and merges the distributor's health entry", async () => {
    const adapter = memAdapter();
    const svc = createHealthService(adapter);
    const fetchMock = vi.fn(async () => new Response("<html>nothing</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await svc.testDistributor("server2u-my");
    expect(result).not.toBeNull();
    expect(result!.distributorId).toBe("server2u-my");
    expect(["working", "blocked", "error"]).toContain(result!.status);

    const saved = await svc.getDistributorHealth();
    expect(saved.some((h) => h.distributorId === "server2u-my")).toBe(true);
    const history = await svc.getHealthHistory();
    expect(history["server2u-my"]?.length).toBe(1);
    vi.unstubAllGlobals();
  });
});
