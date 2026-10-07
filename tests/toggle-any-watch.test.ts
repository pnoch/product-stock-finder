import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Source guards for the any-watch create/toggle split in the product screen.
// Rendering ProductDetailScreen would require mocking expo-router, safe-area,
// useLiveProduct and the toast provider; the observable contract that matters
// (the dialog always creates, the toggle delegates) is pinned at the source.
const screen = readFileSync("app/product/[id].tsx", "utf8");

const slice = (source: string, start: string, end: string) => {
  const a = source.indexOf(start);
  expect(a, `missing start marker: ${start}`).toBeGreaterThanOrEqual(0);
  const b = source.indexOf(end, a + start.length);
  expect(b, `missing end marker: ${end}`).toBeGreaterThan(a);
  return source.slice(a, b);
};

describe("watch-anyway create path", () => {
  it("extracts the any-watch create body into createAnyWatchRecord", () => {
    const helper = slice(
      screen,
      "const createAnyWatchRecord = useCallback",
      "const toggleAnyWatch = useCallback",
    );
    expect(helper).toContain("ensureNotificationPermission");
    expect(helper).toContain('distributorId: "*"');
    expect(helper).toContain('scope: "any"');
    expect(helper).toContain("addStockWatch");
    expect(helper).toContain("setStockWatches");
  });

  it("toggleAnyWatch's create branch delegates to createAnyWatchRecord", () => {
    const toggle = slice(
      screen,
      "const toggleAnyWatch = useCallback",
      "const handleToggleStockWatch = useCallback",
    );
    // The create branch calls the shared helper instead of duplicating it.
    expect(toggle).toContain("await createAnyWatchRecord();");
    expect(toggle).not.toContain("addStockWatch");
  });

  it("the scope dialog's Any distributor creates instead of toggling", () => {
    const dialogIdx = screen.indexOf('text: "Any distributor"');
    expect(dialogIdx).toBeGreaterThanOrEqual(0);
    const dialog = screen.slice(dialogIdx, screen.indexOf("]);", dialogIdx) + 3);
    // The regression: this onPress called toggleAnyWatch, so tapping it while a
    // watch already existed silently REMOVED it.
    expect(dialog).toContain("createAnyWatchRecord");
    expect(dialog).not.toContain("toggleAnyWatch");
  });

  it("has exactly one any-watch record builder (no duplication)", () => {
    expect(screen.split('distributorId: "*"').length - 1).toBe(1);
    expect(screen.split('distributorName: "Any distributor"').length - 1).toBe(1);
  });
});
