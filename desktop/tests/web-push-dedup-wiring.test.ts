import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// The desktop service worker posts `web-push-shown` after showing a push, and
// the shared listener records that event id so the follow-up pull does not show
// it again. Mobile wires this in app/_layout.tsx; without the desktop wiring
// every pushed event was delivered twice.
describe("desktop web-push dedup wiring", () => {
  it("registers the shared push-dedup listener on init", () => {
    const src = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(src).toContain("setupWebNotifications");
    expect(src).toMatch(/return setupWebNotifications\(\)/);
  });
});
