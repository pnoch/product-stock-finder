import { describe, expect, it, vi } from "vitest";
import {
  classifyFetchStatus,
  createMemoryBreakerStore,
  createStorageBreakerStore,
  type BreakerEntry,
} from "../lib/scrapers/resilient";

describe("classifyFetchStatus", () => {
  it("classifies 403 and 429 as blocked", () => {
    expect(classifyFetchStatus("<html>hi</html>", 403)).toBe("blocked");
    expect(classifyFetchStatus("<html>hi</html>", 429)).toBe("blocked");
  });

  it("classifies other 4xx/5xx as error", () => {
    expect(classifyFetchStatus("<html>hi</html>", 500)).toBe("error");
    expect(classifyFetchStatus("<html>hi</html>", 404)).toBe("error");
  });

  it("classifies Cloudflare challenge markers as blocked", () => {
    expect(classifyFetchStatus("Checking your browser...")).toBe("blocked");
    expect(classifyFetchStatus("cf-browser-verification")).toBe("blocked");
    expect(classifyFetchStatus("403 Forbidden")).toBe("blocked");
    expect(classifyFetchStatus("Access Denied")).toBe("blocked");
  });

  it("classifies normal HTML as ok", () => {
    expect(classifyFetchStatus("<html>price $50</html>", 200)).toBe("ok");
    expect(classifyFetchStatus("<html>price $50</html>")).toBe("ok");
  });
});

describe("createMemoryBreakerStore", () => {
  it("returns null for unknown distributors", async () => {
    const store = createMemoryBreakerStore();
    expect(await store.get("d1")).toBeNull();
  });

  it("round-trips entries", async () => {
    const store = createMemoryBreakerStore();
    const entry: BreakerEntry = {
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 2,
      lastAttemptAt: 100,
      cooldownUntil: 200,
      reason: "blocked by site",
    };
    await store.set(entry);
    expect(await store.get("d1")).toEqual(entry);
  });
});

describe("createStorageBreakerStore", () => {
  function makeAdapter() {
    const data = new Map<string, string>();
    return {
      getItem: vi.fn(async (key: string) => data.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        data.set(key, value);
      }),
    };
  }

  it("returns null for unknown distributors", async () => {
    const store = createStorageBreakerStore(makeAdapter());
    expect(await store.get("d1")).toBeNull();
  });

  it("round-trips entries across store instances", async () => {
    const adapter = makeAdapter();
    const store1 = createStorageBreakerStore(adapter);
    const store2 = createStorageBreakerStore(adapter);
    const entry: BreakerEntry = {
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 1,
      lastAttemptAt: 100,
      cooldownUntil: 200,
    };
    await store1.set(entry);
    expect(await store2.get("d1")).toEqual(entry);
  });

  it("keeps multiple distributors independent", async () => {
    const store = createStorageBreakerStore(makeAdapter());
    await store.set({
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 1,
      lastAttemptAt: 0,
      cooldownUntil: 100,
    });
    await store.set({
      distributorId: "d2",
      status: "working",
      consecutiveFailures: 0,
      lastAttemptAt: 0,
      cooldownUntil: 0,
    });
    expect((await store.get("d1"))?.status).toBe("blocked");
    expect((await store.get("d2"))?.status).toBe("working");
  });
});
