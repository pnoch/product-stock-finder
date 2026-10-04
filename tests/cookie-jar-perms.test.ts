import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const BROWSER_TS = path.join(__dirname, "../lib/scrapers/browser.ts");

describe("distributor cookie jar permissions", () => {
  // The jar holds live distributor session cookies (credentials). A default
  // 0644 write on a shared host leaked them to every local user.
  const src = readFileSync(BROWSER_TS, "utf8");

  it("writes cookie files owner-only", () => {
    expect(src).toContain("{ mode: 0o600 }");
  });

  it("chmods pre-existing cookie files to owner-only", () => {
    // `mode` only applies on create; files from older builds stay 0644.
    expect(src).toContain("chmod(filePath, 0o600)");
  });
});
