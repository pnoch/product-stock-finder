import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("session secret is never a public constant", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("derives an ephemeral secret when JWT_SECRET is unset outside production", async () => {
    // NODE_ENV is typed read-only; the runtime mutation is what matters.
    const env = process.env as Record<string, string | undefined>;
    const previousSecret = process.env.JWT_SECRET;
    const previousEnv = env.NODE_ENV;
    delete process.env.JWT_SECRET;
    // The old guard only threw for the exact string "production", so a built
    // server run with NODE_ENV unset/staging signed sessions with a constant
    // anyone could read from this repo — a full auth bypass.
    env.NODE_ENV = "staging";
    try {
      vi.resetModules();
      const { ENV } = await import("../server/_core/env");
      expect(ENV.cookieSecret).not.toBe("dev-secret-change-in-production");
      // 32 random bytes, hex-encoded.
      expect(ENV.cookieSecret).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
      if (previousEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousEnv;
    }
  });

  it("has no hard-coded fallback left in the auth modules", () => {
    for (const file of ["server/_core/env.ts", "server/_core/oauth.ts"]) {
      expect(
        readFileSync(join(__dirname, "..", file), "utf8"),
        `${file} must not contain a public fallback secret`,
      ).not.toContain("dev-secret-change-in-production");
    }
  });
});
