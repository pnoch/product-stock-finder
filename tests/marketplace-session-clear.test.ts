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
  FACEBOOK_SEARCH_PREFERENCES_KEY,
  MARKETPLACE_CONNECTIONS_KEY,
} from "../lib/marketplace/connections";
import {
  clearMarketplaceSession,
  createMarketplaceOperationTracker,
  CLEAR_TIMEOUT_REASON,
  type MarketplaceCookie,
  type MarketplaceCookieManager,
  type MarketplaceOperationTracker,
} from "../lib/marketplace/session-clear";
import type { WebViewHost } from "../lib/scrapers/webview-host";
import { createStorage } from "../lib/storage";

const READY = {
  kind: "ready" as const,
  checkedAt: "2026-10-13T00:00:00.000Z",
  capability: { kind: "search" as const, query: "mac pro" },
};

function fakeManager(
  overrides: Partial<MarketplaceCookieManager> = {},
): MarketplaceCookieManager {
  return {
    get: async () => ({}),
    set: async () => true,
    ...overrides,
  };
}

function fakeHost(
  clearStorage: (url: string) => Promise<void> = async () => {},
): WebViewHost {
  return {
    load: async () => "",
    clearStorage,
    snapshot: async () => {
      throw new Error("snapshot unused");
    },
  } as unknown as WebViewHost;
}

function memoryStorage() {
  const mem = new Map<string, string>();
  const storage = createStorage({
    getItem: async (key) => mem.get(key) ?? null,
    setItem: async (key, value) => {
      mem.set(key, value);
    },
    removeItem: async (key) => {
      mem.delete(key);
    },
    multiRemove: async (keys) => {
      keys.forEach((key) => mem.delete(key));
    },
  });
  return { mem, storage };
}

beforeEach(() => {
  store.clear();
});

describe("clearMarketplaceSession", () => {
  it("expires the selected site's cookies at their own domain and path", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();
    const get = vi.fn(
      async (_url: string): Promise<Record<string, MarketplaceCookie>> => {
        if (_url === "https://www.facebook.com/") {
          return {
            session: {
              name: "session",
              value: "s",
              domain: ".facebook.com",
              path: "/",
            },
            datr: {
              name: "datr",
              value: "d",
              domain: "www.facebook.com",
              path: "/marketplace",
            },
          };
        }
        return {};
      },
    );
    const set = vi.fn(
      async (_url: string, _cookie: MarketplaceCookie) => true,
    );
    const clearStorage = vi.fn(async (_url: string) => {});

    const result = await clearMarketplaceSession("facebook", {
      connections,
      cookieManager: { get, set },
      host: fakeHost(clearStorage),
    });

    expect(result.outcome).toBe("complete");
    expect(result.expiredCookies).toBe(2);

    const targets = set.mock.calls.map(
      ([url, cookie]) => [url, cookie.name] as const,
    );
    expect(targets).toContainEqual(["https://facebook.com/", "session"]);
    expect(targets).toContainEqual([
      "https://www.facebook.com/marketplace",
      "datr",
    ]);
    for (const [, cookie] of set.mock.calls) {
      expect(cookie.expires).toBe("1970-01-01T00:00:00.000Z");
    }
    expect(clearStorage).toHaveBeenCalledWith("https://www.facebook.com/");
  });

  it("never enumerates or clears unrelated sites during a shopee disconnect", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();
    const get = vi.fn(
      async (_url: string): Promise<Record<string, MarketplaceCookie>> => ({}),
    );
    const set = vi.fn(
      async (_url: string, _cookie: MarketplaceCookie) => true,
    );
    const clearStorage = vi.fn(async (_url: string) => {});

    const result = await clearMarketplaceSession("shopee", {
      connections,
      cookieManager: { get, set },
      host: fakeHost(clearStorage),
    });

    expect(result.outcome).toBe("complete");
    const urls = [
      ...get.mock.calls.map(([url]) => url),
      ...clearStorage.mock.calls.map(([url]) => url),
    ];
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.includes("shopee.co.th"))).toBe(true);
  });

  it("reports partial and marks unverified when origin storage cannot be cleared", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();
    const clearStorage = vi.fn(async (_url: string) => {
      throw new Error("boom");
    });

    const result = await clearMarketplaceSession("lazada", {
      connections,
      cookieManager: fakeManager(),
      host: fakeHost(clearStorage),
    });

    expect(result.outcome).toBe("partial");
    expect(result.originCleared).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(connections.current("lazada")).toMatchObject({ kind: "unverified" });
  });

  it("reports partial when a cookie cannot be expired", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();
    const get = vi.fn(
      async (): Promise<Record<string, MarketplaceCookie>> => ({
        c: { name: "c", domain: "shopee.co.th", path: "/" },
      }),
    );
    const set = vi.fn(async () => {
      throw new Error("nope");
    });

    const result = await clearMarketplaceSession("shopee", {
      connections,
      cookieManager: { get, set },
      host: fakeHost(),
    });

    expect(result.outcome).toBe("partial");
    expect(result.failedCookies).toBe(1);
    expect(connections.current("shopee")).toMatchObject({ kind: "unverified" });
  });

  it("reports unavailable when the native modules are absent", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();

    const result = await clearMarketplaceSession("facebook", {
      connections,
      cookieManager: null,
      host: null,
    });

    expect(result.outcome).toBe("unavailable");
    expect(result.reason).toBeTruthy();
    expect(connections.current("facebook")).toEqual({ kind: "unavailable" });
  });

  it("invalidates the generation before clearing so a late probe cannot restore readiness", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();
    const generation = connections.beginVerification("facebook");

    const result = await clearMarketplaceSession("facebook", {
      connections,
      cookieManager: fakeManager(),
      host: fakeHost(),
    });

    expect(result.outcome).toBe("complete");
    await connections.complete("facebook", generation, READY);
    expect(connections.current("facebook")).toEqual({ kind: "not_checked" });
  });

  it("waits for an in-flight site operation before the clearing pass", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();
    const operations = createMarketplaceOperationTracker();
    const order: string[] = [];
    expect(operations.begin("facebook")).toBe(true);

    const clearStorage = vi.fn(async (_url: string) => {
      order.push("clear");
    });
    const finishing = new Promise<void>((resolve) => {
      setTimeout(() => {
        order.push("operation-done");
        operations.end("facebook");
        resolve();
      }, 20);
    });

    const result = await clearMarketplaceSession("facebook", {
      connections,
      cookieManager: fakeManager(),
      host: fakeHost(clearStorage),
      operations,
      waitTimeoutMs: 500,
    });
    await finishing;

    expect(result.outcome).toBe("complete");
    expect(order[0]).toBe("operation-done");
    expect(order).toContain("clear");
  });

  it("reports a timeout instead of success when operations cannot be stopped", async () => {
    const connections = createMarketplaceConnectionsService();
    await connections.load();
    const stalled: MarketplaceOperationTracker = {
      begin: () => false,
      end: () => {},
      isDisconnecting: () => true,
      markDisconnecting: () => {},
      waitForIdle: async () => false,
      terminate: async () => {},
    };

    const result = await clearMarketplaceSession("facebook", {
      connections,
      cookieManager: fakeManager(),
      host: fakeHost(),
      operations: stalled,
      waitTimeoutMs: 5,
    });

    expect(result.outcome).toBe("partial");
    expect(result.reason).toBe(CLEAR_TIMEOUT_REASON);
    expect(connections.current("facebook")).toMatchObject({ kind: "unverified" });
  });

  it("refuses a new operation while a site is disconnecting", () => {
    const operations = createMarketplaceOperationTracker();
    operations.markDisconnecting("facebook", true);
    expect(operations.begin("facebook")).toBe(false);
    operations.markDisconnecting("facebook", false);
    expect(operations.begin("facebook")).toBe(true);
  });
});

describe("clear-all-data integration", () => {
  it("clearAllData removes the device-local marketplace keys", async () => {
    const { mem, storage } = memoryStorage();
    mem.set(MARKETPLACE_CONNECTIONS_KEY, JSON.stringify({}));
    mem.set(FACEBOOK_SEARCH_PREFERENCES_KEY, JSON.stringify({}));

    await storage.clearAllData();

    expect(mem.has(MARKETPLACE_CONNECTIONS_KEY)).toBe(false);
    expect(mem.has(FACEBOOK_SEARCH_PREFERENCES_KEY)).toBe(false);
  });

  it("account sign-out preserves device-local marketplace keys", async () => {
    const { mem, storage } = memoryStorage();
    mem.set(MARKETPLACE_CONNECTIONS_KEY, JSON.stringify({}));
    mem.set(FACEBOOK_SEARCH_PREFERENCES_KEY, JSON.stringify({}));

    await storage.clearAccountData();

    expect(mem.has(MARKETPLACE_CONNECTIONS_KEY)).toBe(true);
    expect(mem.has(FACEBOOK_SEARCH_PREFERENCES_KEY)).toBe(true);
  });
});
