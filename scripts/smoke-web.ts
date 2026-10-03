// Headless smoke test for the exported web SPA, served through the real
// `registerSpa` path so the injected PWA head tags are exercised. Catches
// runtime-only failures (blank page / `import.meta` in a classic script) that
// compile fine but render nothing, and verifies the installability surface
// (manifest link, manifest.json, sw.js, service-worker registration).
//
// Run after `pnpm build:web`. Usage: pnpm smoke:web
import { chromium } from "playwright";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { registerSpa } from "../server/spa";

const dist = path.resolve("dist-web");
if (!existsSync(path.join(dist, "index.html"))) {
  console.error("smoke-web: dist-web/index.html missing — run `pnpm build:web` first");
  process.exit(1);
}

const errors: string[] = [];

async function main() {
  const app = express();
  if (!registerSpa(app, dist)) {
    throw new Error("registerSpa returned false");
  }
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(String(e.message)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });

    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const text = (await page.evaluate(() => document.body.innerText)).trim();

    // A blank body means the app failed to mount.
    if (text.length < 20) {
      throw new Error(`blank page (body length ${text.length})`);
    }
    // `import.meta` outside a module is the specific failure this guards.
    const fatal = errors.find((e) => e.includes("import.meta"));
    if (fatal) throw new Error(fatal);

    // The served shell must carry the injected install tags; plain static
    // serving (without registerSpa) would silently omit them.
    const html = await (await fetch(base)).text();
    if (!html.includes('rel="manifest"')) {
      throw new Error("served HTML is missing the manifest link");
    }

    const manifest = await fetch(`${base}/manifest.json`);
    if (!manifest.ok) throw new Error(`/manifest.json -> ${manifest.status}`);
    const manifestType = manifest.headers.get("content-type") ?? "";
    if (!manifestType.includes("application/json")) {
      throw new Error(`/manifest.json content-type is ${manifestType}`);
    }

    const sw = await fetch(`${base}/sw.js`);
    if (sw.status !== 200) throw new Error(`/sw.js -> ${sw.status}`);

    // The app registers the service worker at startup; without it the browser
    // never offers install.
    const registered = await page
      .waitForFunction(
        async () => {
          if (!("serviceWorker" in navigator)) return false;
          return (await navigator.serviceWorker.getRegistrations()).length > 0;
        },
        null,
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!registered) throw new Error("no service worker registration after load");

    console.log(`smoke-web: ok (rendered ${text.length} chars, manifest + sw verified)`);
  } finally {
    await browser.close();
    server.close();
  }
}

void main().catch((error) => {
  console.error(`smoke-web: ${error instanceof Error ? error.message : String(error)}`);
  console.error("errors:", errors.slice(0, 5));
  process.exitCode = 1;
});
