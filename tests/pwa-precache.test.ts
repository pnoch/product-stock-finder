import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("PWA precache", () => {
  it("public/manifest.json exists with required fields", () => {
    const p = path.resolve("public/manifest.json");
    expect(fs.existsSync(p)).toBe(true);
    const json = JSON.parse(fs.readFileSync(p, "utf-8"));
    expect(json.name).toBe("Product Stock Finder");
    expect(json.short_name).toBeTruthy();
    expect(json.start_url).toBe("/");
    expect(json.display).toBe("standalone");
    expect(Array.isArray(json.icons)).toBe(true);
    expect(json.icons.length).toBeGreaterThan(0);
    const iconSrcs = json.icons.map((i: any) => i.src);
    expect(iconSrcs.some((s: string) => s.includes("icon.png"))).toBe(true);
  });

  it("public/sw.js contains precache logic beyond push", () => {
    const p = path.resolve("public/sw.js");
    const content = fs.readFileSync(p, "utf-8");
    expect(content).toContain("PRECACHE");
    expect(content).toContain('"/index.html"');
    expect(content).toContain("install");
    expect(content).toContain("caches.open");
    // still has push handling
    expect(content).toContain('addEventListener("push"');
  });
});
