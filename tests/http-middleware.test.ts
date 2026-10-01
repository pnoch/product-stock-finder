import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import {
  registerBodyParsers,
  registerCors,
  registerSecurityHeaders,
  resolveTrustProxy,
} from "../server/http-middleware";

let close: (() => void) | null = null;
afterEach(() => {
  close?.();
  close = null;
});

function serve(build: (app: express.Express) => void) {
  const app = express();
  build(app);
  const server = app.listen(0);
  close = () => server.close();
  const port = (server.address() as AddressInfo).port;
  return (path: string, init?: RequestInit) =>
    fetch(`http://127.0.0.1:${port}${path}`, init);
}

describe("registerCors", () => {
  it("reflects only allowlisted origins, with the BYO-LLM headers allowed", async () => {
    const request = serve((app) => {
      registerCors(app, new Set(["https://app.example.com"]));
      app.get("/api/thing", (_req, res) => res.json({ ok: true }));
    });

    const allowed = await request("/api/thing", {
      headers: { origin: "https://app.example.com" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://app.example.com",
    );
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");
    // Without these the preflight blocks every BYO-LLM call cross-origin.
    const allowedHeaders = allowed.headers.get("access-control-allow-headers") ?? "";
    for (const header of ["X-LLM-Provider", "X-LLM-Key", "X-LLM-Model", "X-LLM-Url"]) {
      expect(allowedHeaders.toLowerCase()).toContain(header.toLowerCase());
    }

    const denied = await request("/api/thing", {
      headers: { origin: "https://evil.example.com" },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    expect(denied.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("answers a CORS preflight with 200", async () => {
    const request = serve((app) => {
      registerCors(app, new Set(["https://app.example.com"]));
    });
    const res = await request("/api/thing", {
      method: "OPTIONS",
      headers: { origin: "https://app.example.com" },
    });
    expect(res.status).toBe(200);
  });
});

describe("registerBodyParsers", () => {
  const bigBody = JSON.stringify({ data: "x".repeat(300_000) });

  it("accepts a large sync.push body but not a look-alike path", async () => {
    const request = serve((app) => {
      registerBodyParsers(app);
      app.post(/.*/, (req, res) => res.json({ ok: true, hasBody: "data" in req.body }));
    });

    const push = await request("/api/trpc/sync.push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bigBody,
    });
    expect(push.status).toBe(200);

    const batched = await request("/api/trpc/sync.push,prices.get?batch=1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bigBody,
    });
    expect(batched.status).toBe(200);

    // Prefix matching used to give this look-alike the 10 MB buffering too,
    // unauthenticated — the memory-amplification hole the small default closes.
    const lookalike = await request("/api/trpc/sync.pushX", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bigBody,
    });
    expect(lookalike.status).toBe(413);

    const other = await request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bigBody,
    });
    expect(other.status).toBe(413);
  });
});

describe("resolveTrustProxy", () => {
  it("defaults to one trusted hop and parses TRUST_PROXY overrides", () => {
    // Undefined/empty keeps the current deployment assumption.
    expect(resolveTrustProxy(undefined)).toBe(1);
    expect(resolveTrustProxy("  ")).toBe(1);
    // Direct exposure must not believe a client-sent X-Forwarded-For.
    expect(resolveTrustProxy("false")).toBe(false);
    expect(resolveTrustProxy("0")).toBe(false);
    expect(resolveTrustProxy("true")).toBe(true);
    expect(resolveTrustProxy("2")).toBe(2);
    // A CIDR/IP list is passed through so only known proxies are trusted.
    expect(resolveTrustProxy("10.0.0.0/8, 192.168.0.1")).toBe(
      "10.0.0.0/8, 192.168.0.1",
    );
  });

  it("is actually used by the server entry", () => {
    const src = readFileSync(
      join(__dirname, "..", "server", "_core", "index.ts"),
      "utf8",
    );
    expect(src).toContain("resolveTrustProxy(process.env.TRUST_PROXY)");
  });
});

describe("registerSecurityHeaders", () => {
  it("sets the baseline headers and removes X-Powered-By", async () => {
    const request = serve((app) => {
      registerSecurityHeaders(app);
      app.get("/api/thing", (_req, res) => res.json({ ok: true }));
    });
    const res = await request("/api/thing");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("strict-transport-security")).toContain(
      "max-age=31536000",
    );
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // The framework must not be advertised.
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("allows the configured API origin in connect-src", async () => {
    const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.com";
    try {
      const request = serve((app) => {
        registerSecurityHeaders(app);
        app.get("/api/thing", (_req, res) => res.json({ ok: true }));
      });
      const csp = (await request("/api/thing")).headers.get(
        "content-security-policy",
      );
      // A separate API host would otherwise be blocked by `connect-src 'self'`.
      expect(csp).toContain("connect-src 'self' https://api.example.com");
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
    }
  });

  it("ignores a malformed API base and keeps connect-src same-origin", async () => {
    const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "not a url";
    try {
      const request = serve((app) => {
        registerSecurityHeaders(app);
        app.get("/api/thing", (_req, res) => res.json({ ok: true }));
      });
      const csp = (await request("/api/thing")).headers.get(
        "content-security-policy",
      );
      expect(csp).toContain("connect-src 'self'");
      expect(csp).not.toContain("not a url");
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
    }
  });
});
