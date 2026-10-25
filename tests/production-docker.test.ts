import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// The production browser path only works if the image installs a headed
// browser + a display and the start script opts into headed mode. A silently
// dropped line here would make every Cloudflare-hard distributor fall back to
// plain HTTP (blocked) with no test failure.
describe("production Docker runtime", () => {
  it("installs Xvfb and the patchright browser", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");
    expect(dockerfile).toContain("xvfb");
    expect(dockerfile).toContain("patchright install");
    expect(dockerfile).toContain("scripts/start-production.sh");
  });

  it("uses a Node major that satisfies package.json engines", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as {
      engines?: { node?: string };
    };
    const major = String(pkg.engines?.node ?? "").match(/\d+/)?.[0];
    expect(major).toBeTruthy();
    const dockerfile = await readFile("Dockerfile", "utf8");
    expect(dockerfile).toContain(`FROM node:${major}-`);
  });

  it("starts under a virtual display with headed scraping enabled", async () => {
    const script = await readFile("scripts/start-production.sh", "utf8");
    expect(script).toContain("Xvfb :99");
    expect(script).toContain("[ -S /tmp/.X11-unix/X99 ]");
    expect(script).toContain("export DISPLAY=:99");
    expect(script).toContain("export PSF_BROWSER_HEADED=1");
    expect(script).toContain("starting in headless browser mode");
    expect(script).toContain("node dist/index.js");
  });
});
