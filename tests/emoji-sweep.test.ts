import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DISTRIBUTORS } from "@shared/distributors";

// Notification titles must be plain text: without a system emoji font a title
// emoji renders as an empty "tofu" box in the OS notification surface.
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
      if (!["node_modules", ".expo", "dist"].includes(entry.name)) {
        out.push(...(await walk(p)));
      }
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

describe("emoji sweep", () => {
  it("notification title sources contain no emoji", async () => {
    for (const file of TITLE_SOURCES) {
      const src = await readFile(file, "utf8");
      const found = src.match(/\p{Extended_Pictographic}/gu) ?? [];
      expect(found, `${file} contains emoji`).toEqual([]);
    }
  });

  it("has no countryFlag identifier or regional-indicator emoji", async () => {
    const roots = ["lib", "app", "components", "desktop/src", "shared", "server"];
    for (const root of roots) {
      for (const file of await walk(root)) {
        const src = await readFile(file, "utf8");
        expect(src.includes("countryFlag"), `${file} still uses countryFlag`).toBe(false);
        expect(/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(src), `${file} has a flag emoji`).toBe(false);
      }
    }
  });

  it("every distributor countryCode is a 2-letter ISO code", () => {
    expect(DISTRIBUTORS.length).toBeGreaterThan(0);
    for (const d of DISTRIBUTORS) {
      expect(d.countryCode, `${d.id} countryCode`).toMatch(/^[A-Z]{2}$/);
    }
  });
});
