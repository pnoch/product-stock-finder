import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { registerBodyParsers, registerCors } from "../server/http-middleware";

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
