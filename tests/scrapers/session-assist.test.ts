import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  distributorHost,
  assistUrl,
  isAssistCandidate,
  clearSiteData,
} from "@/lib/scrapers/session-assist";

const clearAll = vi.fn(async () => {});
vi.mock("@react-native-cookies/cookies", () => ({
  default: { clearAll: () => clearAll() },
}));

const parser = {
  id: "x",
  baseUrl: "https://www.pbtech.co.nz",
  buildSearchUrl: (m: string) => `https://www.pbtech.co.nz/search?sf=${m}`,
} as never;

describe("session-assist helpers", () => {
  it("derives the host and assist URL from the parser", () => {
    expect(distributorHost(parser)).toBe("www.pbtech.co.nz");
    expect(assistUrl(parser)).toBe("https://www.pbtech.co.nz");
  });

  it("offers the assist for blocked and no-price outcomes, not working", () => {
    expect(isAssistCandidate("blocked")).toBe(true);
    expect(isAssistCandidate("error", "no price found")).toBe(true);
    expect(isAssistCandidate("error", "No price found · 12ms")).toBe(true);
    expect(isAssistCandidate("error", "Cloudflare challenge could not be resolved")).toBe(false);
    expect(isAssistCandidate("working")).toBe(false);
    expect(isAssistCandidate(null)).toBe(false);
    expect(isAssistCandidate(undefined, undefined)).toBe(false);
  });
});

describe("clearSiteData", () => {
  beforeEach(() => clearAll.mockClear());
  it("clears all cookies via the cookie manager", async () => {
    await clearSiteData();
    expect(clearAll).toHaveBeenCalledTimes(1);
  });
  it("never throws when the cookie manager is unavailable", async () => {
    clearAll.mockRejectedValueOnce(new Error("no native module"));
    await expect(clearSiteData()).resolves.toBeUndefined();
  });
});
