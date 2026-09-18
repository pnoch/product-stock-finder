import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Guards the store-submission config: a missing iOS notification usage string
// makes the OS reject the permission request on a release build, and a
// malformed eas.json blocks `eas submit`.
describe("store submission config", () => {
  it("declares the iOS notification usage description", async () => {
    const src = await readFile("app.config.ts", "utf8");
    // Must be the exact key with a non-empty string value.
    expect(src).toMatch(
      /NSUserNotificationsUsageDescription:\s*\n?\s*"[^"]{20,}"/,
    );
  });

  it("keeps the iOS and Android identifiers in lockstep", async () => {
    const src = await readFile("app.config.ts", "utf8");
    // Both derive from the same bundleId constant.
    expect(src).toMatch(/iosBundleId:\s*bundleId/);
    expect(src).toMatch(/androidPackage:\s*bundleId/);
  });

  it("has valid eas.json build and submit profiles", async () => {
    const raw = await readFile("eas.json", "utf8");
    const eas = JSON.parse(raw) as {
      build: Record<string, unknown>;
      submit: Record<string, unknown>;
    };
    for (const profile of ["development", "preview", "production"]) {
      expect(eas.build[profile], `build profile ${profile}`).toBeDefined();
    }
    expect(eas.submit.production).toBeDefined();
    // A placeholder would silently break `eas submit`.
    expect(raw).not.toContain("REPLACE_WITH");
  });

  it("documents the store listing and privacy URL", async () => {
    const doc = await readFile("docs/store-listing.md", "utf8");
    expect(doc).toContain("Privacy policy");
    expect(doc).toContain("eas submit");
  });
});
