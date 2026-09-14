import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  cacheControlFor,
  hasWebDist,
  registerSpa,
  resolveWebDist,
} from "../server/spa";

describe("spa cache headers", () => {
  it("revalidates the app shell and service worker", () => {
    expect(cacheControlFor("/")).toBe("no-store");
    expect(cacheControlFor("/index.html")).toBe("no-store");
    expect(cacheControlFor("/sw.js")).toBe("no-store");
  });

  it("caches hashed bundles immutably and defaults the rest to no-cache", () => {
    expect(cacheControlFor("/_expo/static/js/web/entry-abc123.js")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(cacheControlFor("/assets/icon.png")).toBe("no-cache");
  });
});

describe("spa registration", () => {
  it("resolves WEB_DIST from env with a dist-web default", () => {
    const prev = process.env.WEB_DIST;
    delete process.env.WEB_DIST;
    expect(resolveWebDist().endsWith("dist-web")).toBe(true);
    process.env.WEB_DIST = "/tmp/spa-test-dist";
    expect(resolveWebDist()).toBe("/tmp/spa-test-dist");
    if (prev === undefined) delete process.env.WEB_DIST;
    else process.env.WEB_DIST = prev;
  });

  it("stays API-only when no web export exists", () => {
    const used: unknown[] = [];
    const result = registerSpa(
      { use: (...args: unknown[]) => void used.push(args) } as unknown as import("express").Express,
      join(tmpdir(), "spa-missing-dist"),
    );
    expect(result).toBe(false);
    expect(used).toHaveLength(0);
  });

  it("requires index.html to count as a web export", () => {
    const dir = mkdtempSync(join(tmpdir(), "spa-empty-"));
    expect(hasWebDist(dir)).toBe(false);
  });
});

describe("spa http behavior", () => {
  let base = "";
  let close: () => Promise<void> = async () => {};

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), "spa-dist-"));
    writeFileSync(join(dir, "index.html"), "<html>app</html>");
    writeFileSync(join(dir, "sw.js"), "self.addEventListener('push',()=>{})");
    mkdirSync(join(dir, "_expo", "static", "js"), { recursive: true });
    writeFileSync(join(dir, "_expo", "static", "js", "entry.js"), "bundle");

    const app = express();
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    expect(registerSpa(app, dir)).toBe(true);

    const server = await new Promise<ReturnType<typeof app.listen>>(
      (resolve) => {
        const s = app.listen(0, () => resolve(s));
      },
    );
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
    close = () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
  });

  afterAll(() => close());

  it("serves index.html at / and deep links", async () => {
    for (const path of ["/", "/product/abc", "/index.html"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("app");
    }
  });

  it("serves sw.js uncached and hashed bundles immutably", async () => {
    const sw = await fetch(`${base}/sw.js`);
    expect(sw.status).toBe(200);
    expect(sw.headers.get("cache-control")).toBe("no-store");

    const bundle = await fetch(`${base}/_expo/static/js/entry.js`);
    expect(bundle.status).toBe(200);
    expect(bundle.headers.get("cache-control")).toContain("immutable");
  });

  it("leaves API routes and non-GET methods alone", async () => {
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const post = await fetch(`${base}/product/abc`, { method: "POST" });
    expect(post.status).toBe(404);
  });

  it("404s unmatched API and storage paths instead of serving the shell", async () => {
    for (const path of ["/api/does-not-exist", "/storage/foo/bar"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Not found" });
    }
  });
});
