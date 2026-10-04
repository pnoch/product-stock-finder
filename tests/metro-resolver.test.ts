import { describe, expect, it } from "vitest";
import {
  resolveBrowserModulePath,
  BROWSER_STUB_PATH,
  BROWSER_NATIVE_PATH,
} from "../scripts/metro-resolver";

describe("resolveBrowserModulePath", () => {
  const request = "/repo/lib/scrapers/browser";
  const utilsOrigin = "/repo/lib/scrapers/utils.ts";

  it("redirects browser.ts to the native module on android/ios", () => {
    expect(resolveBrowserModulePath("android", request)).toBe(BROWSER_NATIVE_PATH);
    expect(resolveBrowserModulePath("ios", request)).toBe(BROWSER_NATIVE_PATH);
  });

  it("matches the real dynamic import from a lib/scrapers module", () => {
    expect(
      resolveBrowserModulePath("android", "./browser", "/repo/lib/scrapers/resilient.ts"),
    ).toBe(BROWSER_NATIVE_PATH);
  });

  it("does not redirect ./browser imported from elsewhere", () => {
    expect(
      resolveBrowserModulePath("android", "./browser", "/repo/components/foo.tsx"),
    ).toBeNull();
  });

  it("leaves web alone (the .web.ts variant resolves normally)", () => {
    expect(resolveBrowserModulePath("web", request)).toBeNull();
    expect(resolveBrowserModulePath("web", "./browser", utilsOrigin)).toBeNull();
  });

  it("ignores unrelated requests on native", () => {
    expect(resolveBrowserModulePath("android", "/repo/lib/scrapers/utils")).toBeNull();
  });

  it("still exports the web stub path", () => {
    expect(BROWSER_STUB_PATH.endsWith("lib/scrapers/browser.web.ts")).toBe(true);
  });
});
