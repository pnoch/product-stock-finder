// Headless smoke test for the exported web SPA. Catches runtime-only failures
// (e.g. `import.meta` in a classic script) that compile fine and pass unit
// tests but render a blank page. Run after `pnpm build:web`.
//
// Usage: node scripts/smoke-web.mjs
import { chromium } from "playwright";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";

const dist = path.resolve("dist-web");
if (!existsSync(path.join(dist, "index.html"))) {
  console.error("smoke-web: dist-web/index.html missing — run `pnpm build:web` first");
  process.exit(1);
}

const app = express();
app.use(express.static(dist));
app.use((_req, res) => res.sendFile(path.join(dist, "index.html")));
const server = app.listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const text = (await page.evaluate(() => document.body.innerText)).trim();

  // A blank body means the app failed to mount.
  if (text.length < 20) {
    console.error(`smoke-web: blank page (body length ${text.length})`);
    console.error("errors:", errors.slice(0, 5));
    process.exit(1);
  }
  // `import.meta` outside a module is the specific failure this guards.
  const fatal = errors.find((e) => e.includes("import.meta"));
  if (fatal) {
    console.error(`smoke-web: ${fatal}`);
    process.exit(1);
  }
  console.log(`smoke-web: ok (rendered ${text.length} chars)`);
} finally {
  await browser.close();
  server.close();
}
