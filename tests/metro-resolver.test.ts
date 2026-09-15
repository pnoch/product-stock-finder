import { describe, expect, it } from "vitest";
import {
  resolveBrowserModulePath,
  BROWSER_STUB_PATH,
} from "../scripts/metro-resolver";

describe("resolveBrowserModulePath", () => {
  const request = "/repo/lib/scrapers/browser";
  const utilsOrigin = "/repo/lib/scrapers/utils.ts";

  it("redirects browser.ts to the web stub on android", () => {
    expect(resolveBrowserModulePath("android", request)).toBe(BROWSER_STUB_PATH);
  });

  it("redirects browser.ts to the web stub on ios", () => {
    expect(resolveBrowserModulePath("ios", request)).toBe(BROWSER_STUB_PATH);
  });

  it("matches the real dynamic import specifier from utils.ts", () => {
    expect(resolveBrowserModulePath("android", "./browser", utilsOrigin)).toBe(
      BROWSER_STUB_PATH,
    );
  });

  it("does not redirect ./browser imported from elsewhere", () => {
    expect(
      resolveBrowserModulePath(
        "android",
        "./browser",
        "/repo/components/foo.tsx",
      ),
    ).toBeNull();
  });

  it("redirects ./browser from any lib/scrapers module (resilient.ts dynamic import)", () => {
    // resilient.ts does `await import("./browser")`; without this Metro bundles
    // the Playwright-backed module into native builds.
    expect(
      resolveBrowserModulePath(
        "android",
        "./browser",
        "/repo/lib/scrapers/resilient.ts",
      ),
    ).toBe(BROWSER_STUB_PATH);
    expect(
      resolveBrowserModulePath(
        "ios",
        "./browser",
        "/repo/lib/scrapers/resilient.ts",
      ),
    ).toBe(BROWSER_STUB_PATH);
  });

  it("leaves web alone", () => {
    expect(resolveBrowserModulePath("web", request)).toBeNull();
    expect(resolveBrowserModulePath("web", "./browser", utilsOrigin)).toBeNull();
  });

  it("ignores unrelated requests on native", () => {
    expect(
      resolveBrowserModulePath("android", "/repo/lib/scrapers/utils"),
    ).toBeNull();
  });
});
