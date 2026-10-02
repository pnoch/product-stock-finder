import { readFile } from "node:fs/promises";
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

describe("emoji sweep", () => {
  it("notification title sources contain no title emoji", async () => {
    for (const file of TITLE_SOURCES) {
      const src = await readFile(file, "utf8");
      for (const ch of TITLE_EMOJI) {
        expect(src.includes(ch), `${file} still contains ${ch}`).toBe(false);
      }
    }
  });
});
