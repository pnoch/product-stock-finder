/**
 * Pure helper used by metro.config.js: on native platforms, redirect requests
 * for lib/scrapers/browser(.ts) to browser-native.ts; on web, the .web.ts
 * variant resolves normally. Playwright never enters any Expo bundle.
 */

const path = require("path");

const STUB_PATH = path.join(__dirname, "..", "lib", "scrapers", "browser.web.ts");
const NATIVE_PATH = path.join(__dirname, "..", "lib", "scrapers", "browser-native.ts");
// cheerio's default entry pulls in node:stream, which Hermes cannot resolve.
// Its browser build is dependency-free and has the same API surface.
const CHEERIO_BROWSER_PATH = path.join(
  __dirname,
  "..",
  "node_modules",
  "cheerio",
  "dist",
  "browser",
  "index.js",
);

function isCheerioModule(request) {
  return request === "cheerio" || request.startsWith("cheerio/");
}

function resolveCheerioPath(platform, request) {
  if (platform !== "ios" && platform !== "android") return null;
  if (!isCheerioModule(request)) return null;
  return CHEERIO_BROWSER_PATH;
}

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
  // A real on-device WebView renderer (browser-native.ts), not the Playwright
  // module — Playwright must never enter an Expo bundle.
  return NATIVE_PATH;
}

module.exports.BROWSER_STUB_PATH = STUB_PATH;
module.exports.BROWSER_NATIVE_PATH = NATIVE_PATH;
module.exports.CHEERIO_BROWSER_PATH = CHEERIO_BROWSER_PATH;
module.exports.resolveBrowserModulePath = resolveBrowserModulePath;
module.exports.resolveCheerioPath = resolveCheerioPath;
