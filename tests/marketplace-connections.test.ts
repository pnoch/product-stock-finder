import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
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
  },
}));

import {
  createMarketplaceConnectionsService,
  isMarketplaceUrlAllowed,
  marketplaceHomeUrl,
  FACEBOOK_SEARCH_PREFERENCES_KEY,
  MARKETPLACE_CONNECTIONS_KEY,
  type MarketplaceConnectionEvent,
} from "../lib/marketplace/connections";

const READY = {
  kind: "ready" as const,
  checkedAt: "2026-10-13T00:00:00.000Z",
  capability: { kind: "search" as const, query: "mac pro" },
};

function storedConnections(): Record<string, { kind: string }> {
  return JSON.parse(store.get(MARKETPLACE_CONNECTIONS_KEY) ?? "{}");
}

beforeEach(() => {
  store.clear();
});

describe("marketplace connections", () => {
  it("starts not checked with empty default facebook preferences", async () => {
    const service = createMarketplaceConnectionsService();
    await service.load();
    expect(service.current("facebook")).toEqual({ kind: "not_checked" });
    expect(service.current("shopee")).toEqual({ kind: "not_checked" });
    expect(service.current("lazada")).toEqual({ kind: "not_checked" });
    expect(service.preferences()).toEqual({
      requestedArea: "",
      requestedRadiusKm: 64,
    });
  });

  it("persists and reloads a completed verification", async () => {
    const service = createMarketplaceConnectionsService();
    await service.load();
    const generation = service.beginVerification("facebook");
    await service.complete("facebook", generation, READY);

    const reloaded = createMarketplaceConnectionsService();
    await reloaded.load();
    expect(reloaded.current("facebook")).toEqual(READY);
  });

  it("persists facebook search preferences", async () => {
    const service = createMarketplaceConnectionsService();
    await service.load();
    await service.setPreferences({
      requestedArea: "Chiang Mai",
      requestedRadiusKm: 30,
    });

    const reloaded = createMarketplaceConnectionsService();
    await reloaded.load();
    expect(reloaded.preferences()).toEqual({
      requestedArea: "Chiang Mai",
      requestedRadiusKm: 30,
    });
  });

  it("resets invalid stored connections to not checked", async () => {
    store.set(MARKETPLACE_CONNECTIONS_KEY, "{not valid json");
    const service = createMarketplaceConnectionsService();
    await service.load();
    expect(service.current("facebook")).toEqual({ kind: "not_checked" });
    expect(service.current("shopee")).toEqual({ kind: "not_checked" });
    expect(service.current("lazada")).toEqual({ kind: "not_checked" });
  });

  it("resets a structurally invalid verification record", async () => {
    store.set(
      MARKETPLACE_CONNECTIONS_KEY,
      JSON.stringify({ facebook: { kind: "ready" } }),
    );
    const service = createMarketplaceConnectionsService();
    await service.load();
    expect(service.current("facebook")).toEqual({ kind: "not_checked" });
  });

  it("resets invalid stored preferences to empty area at 64km", async () => {
    store.set(
      FACEBOOK_SEARCH_PREFERENCES_KEY,
      JSON.stringify({ requestedArea: "Bangkok", requestedRadiusKm: 5000 }),
    );
    const service = createMarketplaceConnectionsService();
    await service.load();
    expect(service.preferences()).toEqual({
      requestedArea: "",
      requestedRadiusKm: 64,
    });
  });

  it("ignores an out-of-range preference update", async () => {
    const service = createMarketplaceConnectionsService();
    await service.load();
    await service.setPreferences({
      requestedArea: "Bangkok",
      requestedRadiusKm: 5000 as unknown as 64,
    });
    expect(service.preferences()).toEqual({
      requestedArea: "",
      requestedRadiusKm: 64,
    });
  });

  it("keeps independent site updates", async () => {
    const service = createMarketplaceConnectionsService();
    await service.load();
    const fbGeneration = service.beginVerification("facebook");
    const shopeeGeneration = service.beginVerification("shopee");
    await service.complete("facebook", fbGeneration, READY);
    await service.complete("shopee", shopeeGeneration, {
      kind: "login_required",
      checkedAt: "2026-10-13T01:00:00.000Z",
    });
    await service.whenIdle();

    expect(service.current("facebook")).toEqual(READY);
    expect(service.current("shopee")).toEqual({
      kind: "login_required",
      checkedAt: "2026-10-13T01:00:00.000Z",
    });
    expect(service.current("lazada")).toEqual({ kind: "not_checked" });

    const stored = storedConnections();
    expect(stored.facebook?.kind).toBe("ready");
    expect(stored.shopee?.kind).toBe("login_required");
    expect(stored.lazada?.kind).toBe("not_checked");
  });

  it("serializes concurrent writes without losing records", async () => {
    const service = createMarketplaceConnectionsService();
    await service.load();
    await Promise.all([
      service.complete("facebook", service.beginVerification("facebook"), {
        kind: "unavailable",
      }),
      service.complete("shopee", service.beginVerification("shopee"), {
        kind: "login_required",
        checkedAt: "2026-10-13T01:00:00.000Z",
      }),
      service.complete("lazada", service.beginVerification("lazada"), {
        kind: "unverified",
        checkedAt: "2026-10-13T02:00:00.000Z",
        reason: "unreadable",
      }),
    ]);
    await service.whenIdle();

    const stored = storedConnections();
    expect(stored.facebook?.kind).toBe("unavailable");
    expect(stored.shopee?.kind).toBe("login_required");
    expect(stored.lazada?.kind).toBe("unverified");
  });

  it("increments the generation monotonically per site", () => {
    const service = createMarketplaceConnectionsService();
    const first = service.beginVerification("facebook");
    const second = service.beginVerification("facebook");
    expect(second).toBeGreaterThan(first);
    expect(service.beginVerification("shopee")).toBe(1);
    expect(service.beginVerification("shopee")).toBe(2);
  });

  it("ignores a completion from a superseded generation", async () => {
    const service = createMarketplaceConnectionsService();
    await service.load();
    const stale = service.beginVerification("facebook");
    const active = service.beginVerification("facebook");

    await service.complete("facebook", stale, {
      kind: "ready",
      checkedAt: "2026-10-13T00:00:00.000Z",
      capability: { kind: "search", query: "old query" },
    });
    expect(service.current("facebook")).toEqual({ kind: "checking" });

    await service.complete("facebook", active, {
      kind: "ready",
      checkedAt: "2026-10-13T00:00:00.000Z",
      capability: { kind: "search", query: "new query" },
    });
    expect(service.current("facebook")).toMatchObject({
      kind: "ready",
      capability: { kind: "search", query: "new query" },
    });
  });

  it("notifies subscribers about preference and verification changes", async () => {
    const service = createMarketplaceConnectionsService();
    const events: MarketplaceConnectionEvent[] = [];
    service.subscribe((event) => events.push(event));

    await service.setPreferences({
      requestedArea: "Phuket",
      requestedRadiusKm: 10,
    });
    const generation = service.beginVerification("facebook");
    await service.complete("facebook", generation, READY);
    await service.whenIdle();

    expect(events.some((event) => event.type === "preferences")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "verification" && event.verification.kind === "ready",
      ),
    ).toBe(true);
  });

  it("stops notifying after unsubscribe", async () => {
    const service = createMarketplaceConnectionsService();
    const events: MarketplaceConnectionEvent[] = [];
    const unsubscribe = service.subscribe((event) => events.push(event));
    unsubscribe();

    await service.invalidate("facebook");
    await service.whenIdle();
    expect(events).toEqual([]);
  });

  it("does not restore readiness after disconnect", async () => {
    const service = createMarketplaceConnectionsService();
    const oldGeneration = service.beginVerification("facebook");
    await service.invalidate("facebook");
    await service.complete("facebook", oldGeneration, {
      kind: "ready",
      checkedAt: "2026-10-13T00:00:00.000Z",
      capability: { kind: "search", query: "mac pro" },
    });
    expect(service.current("facebook")).toEqual({ kind: "not_checked" });
  });

  it("does not notify a late completion after disconnect", async () => {
    const service = createMarketplaceConnectionsService();
    const events: MarketplaceConnectionEvent[] = [];
    service.subscribe((event) => events.push(event));

    const oldGeneration = service.beginVerification("facebook");
    await service.invalidate("facebook");
    await service.complete("facebook", oldGeneration, READY);
    await service.whenIdle();

    expect(
      events.some(
        (event) =>
          event.type === "verification" && event.verification.kind === "ready",
      ),
    ).toBe(false);
  });
});

describe("marketplace url policy", () => {
  it("accepts configured https hosts", () => {
    expect(
      isMarketplaceUrlAllowed("facebook", marketplaceHomeUrl("facebook")),
    ).toBe(true);
    expect(
      isMarketplaceUrlAllowed(
        "facebook",
        "https://web.facebook.com/marketplace/",
      ),
    ).toBe(true);
    expect(
      isMarketplaceUrlAllowed("facebook", "https://m.facebook.com/login"),
    ).toBe(true);
    expect(
      isMarketplaceUrlAllowed("facebook", "https://www.facebook.com:443/"),
    ).toBe(true);
    expect(
      isMarketplaceUrlAllowed("shopee", "https://shopee.co.th/product/1"),
    ).toBe(true);
    expect(
      isMarketplaceUrlAllowed("lazada", "https://www.lazada.co.th/products/x"),
    ).toBe(true);
  });

  it("rejects lookalike hosts, http, ports, and credentials", () => {
    expect(
      isMarketplaceUrlAllowed("facebook", "https://web.facebook.com.evil.com/"),
    ).toBe(false);
    expect(
      isMarketplaceUrlAllowed("facebook", "http://www.facebook.com/"),
    ).toBe(false);
    expect(
      isMarketplaceUrlAllowed("facebook", "https://www.facebook.com:8443/"),
    ).toBe(false);
    expect(
      isMarketplaceUrlAllowed(
        "facebook",
        "https://user:pass@www.facebook.com/",
      ),
    ).toBe(false);
    expect(isMarketplaceUrlAllowed("facebook", "https://evil.com/")).toBe(
      false,
    );
    expect(isMarketplaceUrlAllowed("shopee", "https://www.lazada.co.th/")).toBe(
      false,
    );
    expect(isMarketplaceUrlAllowed("lazada", "https://lazada.co.th/")).toBe(
      false,
    );
  });
});
