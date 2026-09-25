import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Dialogs that are too custom for the shared `Modal` (variable size, custom
// footer, scrolling body) must still be keyboard-accessible. They previously
// used hand-rolled `fixed inset-0` overlays with no Escape handler, focus
// management, or dialog role.
const DIALOG_PAGES = [
  "desktop/src/pages/Settings.tsx",
  "desktop/src/pages/Stats.tsx",
  "desktop/src/pages/Watchlist.tsx",
  "desktop/src/pages/Alerts.tsx",
  "desktop/src/pages/Search.tsx",
];

describe("desktop custom dialogs are keyboard-accessible", () => {
  it("uses DialogOverlay instead of hand-rolled overlay divs", async () => {
    for (const file of DIALOG_PAGES) {
      const src = await readFile(file, "utf8");
      expect(src).toContain("DialogOverlay");
      expect(src).not.toMatch(/<div className="fixed inset-0 z-50 /);
    }
  });

  it("DialogOverlay provides Escape, focus, and dialog semantics", async () => {
    const src = await readFile("desktop/src/components/DialogOverlay.tsx", "utf8");
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain("previousActiveRef.current.focus()");
  });
});
