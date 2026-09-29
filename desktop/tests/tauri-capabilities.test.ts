import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// The Tauri webview is one XSS away from its own command surface, so the
// capability grants and the CSP are the boundary. This pins the boundary so a
// future capability/plugin addition cannot silently widen it.
const SRC_TAURI = join(__dirname, "..", "src-tauri");

function capabilities(): { identifier: string; windows?: string[]; permissions?: string[] }[] {
  const dir = join(SRC_TAURI, "capabilities");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

function csp(): string {
  const conf = JSON.parse(
    readFileSync(join(SRC_TAURI, "tauri.conf.json"), "utf8"),
  ) as { app?: { security?: { csp?: string | null } } };
  return conf.app?.security?.csp ?? "";
}

describe("tauri capability boundary", () => {
  it("grants no command-execution or unrestricted-network permissions", () => {
    const dangerous =
      /(^|:)(shell|process|execute|spawn|kill|allow-execute|allow-open|http|allow-all|default-no-scope)/i;
    for (const capability of capabilities()) {
      for (const permission of capability.permissions ?? []) {
        expect(
          dangerous.test(permission),
          `${capability.identifier} grants ${permission}`,
        ).toBe(false);
      }
    }
  });

  it("scopes every capability to known windows only", () => {
    for (const capability of capabilities()) {
      expect(capability.windows ?? []).toContain("main");
      for (const window of capability.windows ?? []) {
        expect(["main"]).toContain(window);
      }
    }
  });

  it("ships every asset index.html references", () => {
    // Vite copies public/ verbatim; a referenced asset with no file 404s (the
    // stock template pointed at a /vite.svg that was never shipped).
    const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
    const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)]
      .map((m) => m[1]!)
      // /src/* are Vite module entries (bundled, not public assets).
      .filter((ref) => !ref.startsWith("/src/"));
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const file = join(__dirname, "..", "public", ref.replace(/^\//, ""));
      expect(existsSync(file), `missing referenced asset: ${ref}`).toBe(true);
    }
  });

  it("keeps the CSP hardening invariants", () => {
    const policy = csp();
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    // A blocked eval is what stops an injected string from becoming code.
    expect(policy).not.toContain("unsafe-eval");
    // A null CSP would disable the boundary entirely.
    expect(policy.length).toBeGreaterThan(0);
  });
});
