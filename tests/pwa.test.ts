import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withPwaHead } from "../server/spa";

const ROOT = path.join(__dirname, "..");

describe("withPwaHead", () => {
  const html =
    "<!DOCTYPE html><html><head><title>t</title></head><body></body></html>";

  it("injects the manifest link and iOS/theme meta before </head>", () => {
    const out = withPwaHead(html);
    expect(out).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(out).toContain('<meta name="theme-color" content="#0F52BA" />');
    expect(out).toContain('rel="apple-touch-icon"');
    expect(out).toContain('name="apple-mobile-web-app-capable"');
    expect(out.indexOf('<link rel="manifest"')).toBeLessThan(
      out.indexOf("</head>"),
    );
  });

  it("does not double-inject when a manifest link is already present", () => {
    const once = withPwaHead(html);
    expect(withPwaHead(once)).toBe(once);
  });
});

describe("PWA manifest", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, "public/manifest.json"), "utf8"),
  );

  it("is installable (name, start_url, standalone, id, scope)", () => {
    expect(manifest.name).toBe("Product Stock Finder");
    expect(manifest.short_name).toBe("Stock Finder");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.id).toBe("/");
  });

  it("ships 192, 512 and maskable icons that exist on disk", () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(
      manifest.icons.some(
        (i: { purpose?: string }) => i.purpose === "maskable",
      ),
    ).toBe(true);
    for (const icon of manifest.icons) {
      expect(
        statSync(path.join(ROOT, "public", path.basename(icon.src))).isFile(),
      ).toBe(true);
    }
  });
});

describe("service worker offline shell", () => {
  it("has a fetch handler that falls back to the cached shell", () => {
    const sw = readFileSync(path.join(ROOT, "public/sw.js"), "utf8");
    expect(sw).toContain('addEventListener("fetch"');
    expect(sw).toContain('caches.match("/index.html")');
    expect(sw).toContain('addEventListener("push"');
  });
});
