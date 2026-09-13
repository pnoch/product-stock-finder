import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("oauth stateSecret prod guard (RED)", () => {
  const OLD_SECRET = process.env.JWT_SECRET;
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    if (OLD_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = OLD_SECRET;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws in production without JWT_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.JWT_SECRET;
    let threw = false;
    try {
      const { signOAuthState } = await import("../server/_core/oauth");
      signOAuthState({ redirectUri: "https://x/cb", provider: "google" });
    } catch (e) {
      threw = /JWT_SECRET/.test(String(e));
    }
    expect(threw).toBe(true);
  });
});
