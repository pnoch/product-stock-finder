import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { registerApiNoStore } from "../server/api-cache";

describe("/api responses are never cached", () => {
  let close: (() => void) | null = null;
  afterEach(() => {
    close?.();
    close = null;
  });

  it("sets Cache-Control: no-store on an api response", async () => {
    const app = express();
    registerApiNoStore(app);
    app.get("/api/thing", (_req, res) => res.json({ ok: true }));
    app.get("/other", (_req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    close = () => server.close();
    const port = (server.address() as AddressInfo).port;

    const api = await fetch(`http://127.0.0.1:${port}/api/thing`);
    expect(api.status).toBe(200);
    // A 200 GET without this could be heuristically cached, serving a stale
    // price/alert after a refresh.
    expect(api.headers.get("cache-control")).toBe("no-store");

    // Non-api routes keep their own headers (the SPA shell).
    const other = await fetch(`http://127.0.0.1:${port}/other`);
    expect(other.headers.get("cache-control")).toBeNull();
  });

  it("is wired into the server entry", () => {
    const src = readFileSync(
      join(__dirname, "..", "server", "_core", "index.ts"),
      "utf8",
    );
    expect(src).toContain("registerApiNoStore(app)");
  });
});
