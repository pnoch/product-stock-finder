import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Notification titles must be plain text: without a system emoji font a title
// emoji renders as an empty "tofu" box in the OS notification surface.
const TITLE_EMOJI = ["🟢", "🔴", "🟠", "📈", "💸", "📦", "📊", "💰", "✅", "🧺"];

const TITLE_SOURCES = [
  "lib/notifications.ts",
  "lib/background-tasks/health-alerts.ts",
  "lib/background-tasks/price-check.ts",
  "lib/price-digest.ts",
  "lib/restock.ts",
  "desktop/src/App.tsx",
  "desktop/src/lib/basket-alert.ts",
  "desktop/src/lib/health-probe.ts",
  "server/notifications/build-events.ts",
  "server/notifications/digest.ts",
];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|\.expo|dist/.test(p)) out.push(...(await walk(p)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

describe("emoji sweep", () => {
  it("notification title sources contain no title emoji", async () => {
    for (const file of TITLE_SOURCES) {
      const src = await readFile(file, "utf8");
      for (const ch of TITLE_EMOJI) {
        expect(src.includes(ch), `${file} still contains ${ch}`).toBe(false);
      }
    }
  });

  it("has no countryFlag identifier or regional-indicator emoji", async () => {
    const roots = ["lib", "app", "components", "desktop/src", "shared", "server"];
    for (const root of roots) {
      for (const file of await walk(root)) {
        const src = await readFile(file, "utf8");
        expect(src.includes("countryFlag"), `${file} still uses countryFlag`).toBe(false);
      }
    }
    for (const file of await walk("shared")) {
      const src = await readFile(file, "utf8");
      expect(/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(src), `${file} has a flag emoji`).toBe(false);
    }
  });
});
