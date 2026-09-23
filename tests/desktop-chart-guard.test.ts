import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop chart guard", () => {
  it("renders price history only through the shared component", async () => {
    for (const f of [
      "desktop/src/components/DistributorHistoryModal.tsx",
      "desktop/src/pages/ProductDetail.tsx",
    ]) {
      const text = await readFile(f, "utf8");
      expect(text).toContain("PriceHistoryChart");
      expect(text).not.toContain("<LineChart");
    }
  });

  // QA round 35: the "lowest ever" badge compared history and current price in
  // hardcoded USD while the rest of the page used the display currency, so a
  // EUR/GBP user's badge was computed across mixed units.
  it("computes the lowest-ever badge in the display currency", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = text.indexOf("const isLowestEver");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [bestListing", start));
    expect(block).not.toContain('"USD"');
    expect(block).toContain("displayCurrency");
  });

  // QA round 36: the main Set Alert modal's currency was never seeded from the
  // display currency (mobile does), so a EUR/GBP user created alerts in USD.
  it("seeds the main alert currency from the display currency", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toMatch(/setAlertCurrency\(settings\.displayCurrency/);
  });

  // QA round 38: the desktop basket-alert save used saveSettings with a stale
  // snapshot, clobbering a concurrent settings change. Mobile uses the
  // serialized updateSettings.
  it("saves the basket alert through the serialized updateSettings", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    const start = text.indexOf("const handleSaveBasketAlert");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, []);", start));
    expect(block).toContain("storage.updateSettings");
    expect(block).not.toContain("saveSettings");
  });

  // QA round 41: the desktop Alerts mutation handlers had no try/catch, so a
  // storage failure became an unhandled rejection with no user feedback.
  it("wraps desktop alert mutations in try/catch", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    for (const handler of [
      "const handleToggle",
      "const handleDeleteAlert",
      "const handleRearm",
      "const handleSnoozeAlert",
      "const handleDeleteReminder",
      "const handleDeleteWatch",
    ]) {
      const start = text.indexOf(handler);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, text.indexOf("};", start));
      expect(block).toContain("try {");
      expect(block).toContain("catch");
    }
  });

  // QA round 42: the same class in the desktop Watchlist remove/undo handlers.
  it("wraps desktop watchlist remove/undo in try/catch", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    for (const handler of ["const handleBulkDelete", "const handleUndo", "const handleRemove"]) {
      const start = text.indexOf(handler);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, text.indexOf("};", start));
      expect(block).toContain("try {");
      expect(block).toContain("catch");
    }
  });

  // QA round 43: the desktop ProductDetail reminder/watch/alert writes.
  it("wraps desktop product-detail writes in try/catch", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    for (const handler of [
      "const handleSetReminder",
      "const handleInlineReminder",
      "const handleWatchRestock",
      "const handleToggleListingWatch",
    ]) {
      const start = text.indexOf(handler);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, text.indexOf("\n  };", start));
      expect(block).toContain("try {");
      expect(block).toContain("catch");
    }
    // createPriceAlert must not reject on a storage failure.
    const alertStart = text.indexOf("async function createPriceAlert");
    const alertBlock = text.slice(alertStart, text.indexOf("return { ok: true, id };", alertStart));
    expect(alertBlock).toContain("try {");
    expect(alertBlock).toContain("catch");
  });
});
