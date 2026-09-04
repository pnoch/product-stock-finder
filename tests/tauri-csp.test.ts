import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("tauri CSP", () => {
  it("defines an explicit policy instead of relying on no CSP", async () => {
    const raw = await readFile("desktop/src-tauri/tauri.conf.json", "utf8");
    const conf = JSON.parse(raw) as { app?: { security?: { csp?: string | null } } };
    const csp = conf.app?.security?.csp;
    expect(typeof csp === "string" && csp.length > 0).toBe(true);
  });

  it("blocks plugins, frames, and base-uri hijacking", async () => {
    const raw = await readFile("desktop/src-tauri/tauri.conf.json", "utf8");
    const conf = JSON.parse(raw) as { app?: { security?: { csp?: string | null } } };
    const csp = conf.app?.security?.csp ?? "";
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("keeps scripts self-hosted while allowing IPC, API, and images", async () => {
    const raw = await readFile("desktop/src-tauri/tauri.conf.json", "utf8");
    const conf = JSON.parse(raw) as { app?: { security?: { csp?: string | null } } };
    const csp = conf.app?.security?.csp ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("http://ipc.localhost");
    expect(csp).toContain("img-src");
  });
});
