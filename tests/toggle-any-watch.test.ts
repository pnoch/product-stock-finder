import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Source guards for the any-watch create/toggle split in the product screen.
// Rendering ProductDetailScreen would require mocking expo-router, safe-area,
// useLiveProduct and the toast provider; the decision logic is behavior-tested
// in tests/any-watch.test.ts. These guards pin the wiring: the dialog always
// creates, the toggle delegates to the testable lib helper.
const screen = readFileSync("app/product/[id].tsx", "utf8");
const helper = readFileSync("lib/any-watch.ts", "utf8");

const slice = (source: string, start: string, end: string) => {
  const a = source.indexOf(start);
  expect(a, `missing start marker: ${start}`).toBeGreaterThanOrEqual(0);
  const b = source.indexOf(end, a + start.length);
  expect(b, `missing end marker: ${end}`).toBeGreaterThan(a);
  return source.slice(a, b);
};

describe("watch-anyway create path", () => {
  it("createAnyWatchRecord always creates through the shared helper", () => {
    const create = slice(
      screen,
      "const createAnyWatchRecord = useCallback",
      "const toggleAnyWatch = useCallback",
    );
    expect(create).toContain("ensureNotificationPermission");
    expect(create).toContain("toggleAnyWatchRecord");
    expect(create).toContain("isWatching: false");
    expect(create).toContain("setStockWatches");
  });

  it("toggleAnyWatch delegates to the testable helper", () => {
    const toggle = slice(
      screen,
      "const toggleAnyWatch = useCallback",
      "const handleToggleStockWatch = useCallback",
    );
    // The decision is the helper's; the screen supplies state + storage ops.
    expect(toggle).toContain("toggleAnyWatchRecord");
    expect(toggle).toContain('stockWatches["*"]');
    expect(toggle).toContain("addStockWatch");
  });

  it("the scope dialog's Any distributor creates instead of toggling", () => {
    const dialogIdx = screen.indexOf('text: "Any distributor"');
    expect(dialogIdx).toBeGreaterThanOrEqual(0);
    const dialog = screen.slice(
      dialogIdx,
      screen.indexOf("]);", dialogIdx) + 3,
    );
    // The regression: this onPress called toggleAnyWatch, so tapping it while a
    // watch already existed silently REMOVED it.
    expect(dialog).toContain("createAnyWatchRecord");
    expect(dialog).not.toContain("toggleAnyWatch");
  });

  it("has exactly one any-watch record builder (no duplication)", () => {
    expect(helper.split('distributorId: "*"').length - 1).toBe(1);
    expect(helper.split('distributorName: "Any distributor"').length - 1).toBe(
      1,
    );
    expect(screen.split('distributorId: "*"').length - 1).toBe(0);
    expect(screen.split('distributorName: "Any distributor"').length - 1).toBe(
      0,
    );
  });
});
