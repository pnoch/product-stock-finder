import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("../constants/oauth", () => ({
  getApiBaseUrl: vi.fn(() => "https://example.com"),
}));

import { checkHealth } from "../lib/health";
import { getApiBaseUrl } from "../constants/oauth";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.mocked(getApiBaseUrl).mockReturnValue("https://example.com");
});

describe("checkHealth", () => {
  it("returns false when no server is configured", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("");
    expect(await checkHealth()).toBe(false);
  });

  it("returns true when /api/health is ok", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true } as Response));
    expect(await checkHealth()).toBe(true);
  });

  it("returns false on fetch rejection", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await checkHealth()).toBe(false);
  });

  it("returns false on non-ok response", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false } as Response));
    expect(await checkHealth()).toBe(false);
  });

  it("times out after 3s (returns false)", async () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {}) as Promise<Response>);
    const start = Date.now();
    const result = await checkHealth();
    expect(result).toBe(false);
    expect(Date.now() - start).toBeGreaterThanOrEqual(2900);
  }, 5000);
});
