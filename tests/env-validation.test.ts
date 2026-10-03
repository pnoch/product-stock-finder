import { afterEach, describe, expect, it, vi } from "vitest";
import { assertServerEnv, validateServerEnv } from "../server/env-validation";

afterEach(() => vi.restoreAllMocks());

describe("validateServerEnv", () => {
  it("errors on missing DATABASE_URL only in production", () => {
    expect(validateServerEnv({ NODE_ENV: "production" }).some((i) => i.level === "error")).toBe(true);
    expect(validateServerEnv({ NODE_ENV: "development" }).some((i) => i.level === "error")).toBe(false);
  });

  it("warns on empty CORS_ALLOWED_ORIGINS in production", () => {
    const issues = validateServerEnv({ NODE_ENV: "production", DATABASE_URL: "mysql://x" });
    expect(issues).toEqual([
      expect.objectContaining({ level: "warn", message: expect.stringContaining("CORS_ALLOWED_ORIGINS") }),
    ]);
  });

  it("warns on each partially-configured group", () => {
    const issues = validateServerEnv({
      NODE_ENV: "development",
      GOOGLE_CLIENT_ID: "a",
      APPLE_CLIENT_ID: "b",
      VAPID_SUBJECT: "c",
      RESEND_API_KEY: "d",
    });
    const labels = issues.map((i) => i.message);
    expect(labels).toHaveLength(4);
    expect(labels.join(" ")).toContain("Google OAuth");
    expect(labels.join(" ")).toContain("Apple OAuth");
    expect(labels.join(" ")).toContain("VAPID");
    expect(labels.join(" ")).toContain("email");
  });

  it("is silent when groups are complete or absent", () => {
    expect(
      validateServerEnv({
        NODE_ENV: "production",
        DATABASE_URL: "mysql://x",
        CORS_ALLOWED_ORIGINS: "https://app.example.com",
        GOOGLE_CLIENT_ID: "a",
        GOOGLE_CLIENT_SECRET: "b",
        VAPID_SUBJECT: "mailto:x@y",
        VAPID_PUBLIC_KEY: "p",
        VAPID_PRIVATE_KEY: "s",
        RESEND_API_KEY: "r",
        EMAIL_FROM: "a@b.c",
      }),
    ).toEqual([]);
  });

  it("treats a whitespace-only value as missing", () => {
    const issues = validateServerEnv({ NODE_ENV: "production", DATABASE_URL: "   " });
    expect(issues.some((i) => i.level === "error" && i.message.includes("DATABASE_URL"))).toBe(true);
  });
});

describe("assertServerEnv", () => {
  it("logs via console.error/warn with an [env] prefix and throws on a production error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertServerEnv({ NODE_ENV: "production" })).toThrow(/environment validation failed/i);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("[env]"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[env]"));
  });

  it("never throws for warnings or in development", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertServerEnv({ NODE_ENV: "development", VAPID_SUBJECT: "x" })).not.toThrow();
    expect(() => assertServerEnv({ NODE_ENV: "development" })).not.toThrow();
  });
});
