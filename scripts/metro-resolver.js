/**
 * Pure helper used by metro.config.js: on native platforms, redirect requests
 * for lib/scrapers/browser(.ts) to the playwright-free browser.web.ts stub so
 * Playwright never enters Android/iOS bundles.
 */

const path = require("path");

const STUB_PATH = path.join(__dirname, "..", "lib", "scrapers", "browser.web.ts");

function isBrowserModule(request, originModulePath) {
  const normalized = String(request).replace(/\.ts$/, "").replace(/\.js$/, "");
  if (normalized.endsWith("/scrapers/browser") || normalized === "browser") {
    return true;
  }
  // Any module inside lib/scrapers/ importing "./browser" (e.g. resilient.ts's
  // dynamic `await import("./browser")`) must also be redirected, or Metro
  // bundles the Playwright-backed module into native builds.
  return (
    request === "./browser" &&
    typeof originModulePath === "string" &&
    originModulePath.replace(/\\/g, "/").includes("/lib/scrapers/")
  );
}

function resolveBrowserModulePath(platform, request, originModulePath) {
  if (platform !== "ios" && platform !== "android") return null;
  if (!isBrowserModule(request, originModulePath)) return null;
  return STUB_PATH;
}

module.exports.BROWSER_STUB_PATH = STUB_PATH;
module.exports.resolveBrowserModulePath = resolveBrowserModulePath;
