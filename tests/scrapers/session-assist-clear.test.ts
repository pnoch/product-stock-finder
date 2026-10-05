import { describe, expect, it, vi, beforeEach } from "vitest";

const get = vi.fn(async (_url: string) => ({
  sid: { name: "sid", value: "x", domain: "pbtech.co.nz" },
}));
const set = vi.fn(async (_url: string, _cookie: unknown) => true);
const clearAll = vi.fn(async () => true);
vi.mock("@react-native-cookies/cookies", () => ({
  default: {
    get: (url: string) => get(url),
    set: (url: string, cookie: unknown) => set(url, cookie),
    clearAll: () => clearAll(),
  },
}));

const clearStorage = vi.fn(async (_url: string) => {});
vi.mock("@/lib/scrapers/webview-host", () => ({
  getWebViewHost: () => ({ clearStorage }),
}));

const clearUnlocked = vi.fn(async (_id: string) => {});
const clearAllUnlocked = vi.fn(async () => {});
const getUnlocked = vi.fn(async () => ({ "pbtech-nz": "t" }));
vi.mock("@/lib/scrapers/session-store", () => ({
  clearUnlocked: (id: string) => clearUnlocked(id),
  clearAllUnlocked: () => clearAllUnlocked(),
  getUnlocked: () => getUnlocked(),
}));

import { clearDistributorSession, clearSiteData } from "@/lib/scrapers/session-assist";

const parser = { id: "pbtech-nz", baseUrl: "https://www.pbtech.co.nz" } as never;

describe("clearDistributorSession", () => {
  beforeEach(() => {
    get.mockClear(); set.mockClear(); clearStorage.mockClear(); clearUnlocked.mockClear();
  });

  it("expires the domain's cookies, clears DOM storage, and clears the flag", async () => {
    await clearDistributorSession(parser);
    expect(get).toHaveBeenCalledWith("https://www.pbtech.co.nz");
    expect(set).toHaveBeenCalledTimes(1);
    expect(clearStorage).toHaveBeenCalledWith("https://www.pbtech.co.nz");
    expect(clearUnlocked).toHaveBeenCalledWith("pbtech-nz");
  });
});

describe("clearSiteData", () => {
  it("clears all cookies, every unlocked origin's storage, and the set", async () => {
    clearAll.mockClear(); clearStorage.mockClear(); clearAllUnlocked.mockClear();
    await clearSiteData();
    expect(clearAll).toHaveBeenCalledTimes(1);
    expect(clearStorage).toHaveBeenCalledWith("https://pbtech.co.nz");
    expect(clearAllUnlocked).toHaveBeenCalledTimes(1);
  });
});
