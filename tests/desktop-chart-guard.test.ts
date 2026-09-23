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

  // QA round 44: the desktop "Clear all data" handler awaited the wipe with no
  // try/catch, so a storage failure was an unhandled rejection with no feedback.
  it("wraps desktop clear-all-data in try/catch", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const start = text.indexOf("const handleClearAllData");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("\n  };", start));
    expect(block).toContain("try {");
    expect(block).toContain("catch");
  });

  // QA round 45: the desktop Compare cross-distributor alert awaited
  // storage.addAlert with no try/catch (mobile wraps it).
  it("wraps the desktop compare cross-alert in try/catch", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const start = text.indexOf("const handleCrossAlert");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [id, product, alertTarget", start));
    expect(block).toContain("try {");
    expect(block).toContain("catch");
  });

  // QA round 47: desktop alerts created via createPriceAlert never reached the
  // screen's `alerts` state, so the Distributor Targets table stayed stale.
  it("syncs desktop product-detail alerts state after creating an alert", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    // createPriceAlert returns the created alert.
    const alertStart = text.indexOf("async function createPriceAlert");
    expect(text.slice(alertStart, text.indexOf("return { ok: true, id, alert };", alertStart))).toContain("alert");
    // Every caller appends the returned alert to state. (The callers destructure
    // after awaiting, so match the destructure and the state append separately.)
    const callers = text.match(/= await createPriceAlert\(/g) ?? [];
    expect(callers.length).toBe(4);
    expect((text.match(/const \{ ok, alert \} = result;/g) ?? []).length).toBe(4);
    expect((text.match(/setAlerts\(\(prev\) => \[\.\.\.prev, alert\]\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  // QA round 50: the basket-alert save optimistically set the threshold but
  // never reverted it on failure (and desktop had no try/catch at all).
  it("reverts the desktop basket threshold when the save fails", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    const start = text.indexOf("const handleSaveBasketAlert");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [basketThreshold, showToast]);", start));
    expect(block).toContain("const previous = basketThreshold");
    expect(block).toContain("setBasketThreshold(previous)");
    expect(block).toContain("catch");
  });

  // QA round 91: desktop watchlist Undo restored only the product, losing the
  // alerts the removal cascade deleted (mobile fixed in Phase 342).
  it("restores the deleted product's alerts on desktop undo", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const start = text.indexOf("const handleRemove");
    const block = text.slice(start, start + 900);
    expect(block).toContain("storage.getAlerts()");
    expect(block).toContain("showUndoBar(product, removedAlerts)");
    const undoStart = text.indexOf("const handleUndo");
    const undoBlock = text.slice(undoStart, text.indexOf("};", undoStart));
    expect(undoBlock).toContain("undoAlertsRef.current");
    expect(undoBlock).toContain("storage.addAlert(alert)");
  });

  // QA round 120: desktop rendered a zero triggeredPrice as "Triggered at
  // $0.00" (a server-detected trigger can store 0). Mobile guards `> 0`
  // (Phase 356).
  it("guards the desktop triggered-price display against a zero", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    const start = text.indexOf("Triggered at");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("alert.currency,", start));
    expect(block).toMatch(/alert\.triggeredPrice && alert\.triggeredPrice > 0/);
    expect(block).not.toContain("alert.triggeredPrice ?? alert.targetPrice");
  });

  // QA round 119: desktop accessed `listing.priceHistory.<method>` without the
  // `?? []` guard mobile uses, so a corrupt/legacy listing (missing the field)
  // crashed the page (Stats, Watchlist, DistributorHistoryModal). Same class as
  // the mobile fix in Phase 359.
  it("guards desktop listing.priceHistory access with ?? []", async () => {
    const files = [
      "desktop/src/pages/Stats.tsx",
      "desktop/src/pages/Watchlist.tsx",
      "desktop/src/pages/Compare.tsx",
      "desktop/src/pages/ProductDetail.tsx",
      "desktop/src/components/DistributorHistoryModal.tsx",
    ];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      // No bare `X.priceHistory.<method>` (optional-chained `?.priceHistory` and
      // the guarded `priceHistory &&` / `priceHistory.length` checks are fine).
      const bare = (text.match(/[A-Za-z_$][\w$]*\.priceHistory\.(some|map|filter|find|reduce|forEach|flatMap|slice|sort)/g) ?? [])
        .filter((m) => !m.includes("?.priceHistory"));
      expect(bare).toEqual([]);
    }
  });

  // QA round 118: desktop only treated price_drop as stale, so a stale
  // price_rise event for an inactive alert still fired (mobile checks both).
  it("skips stale price_rise events in desktop sync", async () => {
    const text = await readFile("desktop/src/server-notifications.ts", "utf8");
    const start = text.indexOf("const stalePriceEvent");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("if (!stalePriceEvent)", start));
    expect(block).toMatch(/event\.type === "price_drop" \|\| event\.type === "price_rise"/);
  });

  // QA round 117: desktop reconcileEvent omitted the event time, so a stale
  // server event could re-deactivate a freshly re-armed alert (mobile passes it).
  it("passes the event time to deactivateAlert in desktop reconcileEvent", async () => {
    const text = await readFile("desktop/src/server-notifications.ts", "utf8");
    const start = text.indexOf("async function reconcileEvent");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("async function", start + 10));
    expect(block).toContain("event.createdAt");
    expect(block).toMatch(/deactivateAlert\(\s*event\.alertId,\s*event\.triggeredPrice \?\? 0,\s*event\.createdAt,?\s*\)/);
  });

  // QA round 87: desktop getDesktopDeviceId could reject on a storage failure
  // and minted a new id per call; it must cache a stable in-memory fallback.
  it("keeps a stable fallback device id on storage failure", async () => {
    const text = await readFile("desktop/src/lib/device-id.ts", "utf8");
    expect(text).toContain("memoryFallbackId");
    expect(text).toContain("try {");
    expect(text).toContain("catch");
  });

  // QA round 78: desktop Stats saved a digest snapshot on every load, advancing
  // the diff base so the digest showed changes since the last visit rather than
  // since the last sent digest (App.tsx owns the snapshot lifecycle).
  it("does not advance the digest snapshot from desktop Stats", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).not.toContain("savePriceDigestSnapshot");
  });

  // QA round 77: desktop Home.refreshDashboard had a redundant read-and-discard
  // block that also cleared the loadError the previous block had just set.
  it("has no redundant read-and-discard in desktop Home refresh", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    const start = text.indexOf("const refreshDashboard");
    const block = text.slice(start, text.indexOf("}, [loadDashboard, refreshWatchlist, refreshAlerts]);", start));
    expect(block).not.toContain("await storage.getWatchlist();");
    expect(block).not.toContain("await storage.getAlerts();");
  });

  // QA round 76: the desktop CSV import created duplicate alerts on re-import.
  it("skips duplicate alerts in the desktop CSV import", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const start = text.indexOf("const handleImportFile");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [refresh, showToast]);", start));
    expect(block).toContain("existingAlertProductIds");
    expect(block).toMatch(/row\.targetPrice !== null && !existingAlertProductIds\.has\(product\.id\)/);
  });

  // QA round 74: desktop ResetPassword / Settings forgot-password fetched
  // `${getApiBaseUrl()}/...` without checking the base URL was configured.
  it("guards desktop auth fetches against an empty base URL", async () => {
    for (const [file, needle] of [
      ["desktop/src/pages/ResetPassword.tsx", "const baseUrl = getApiBaseUrl();"],
      ["desktop/src/pages/Settings.tsx", "const baseUrl = getApiBaseUrl();"],
    ] as const) {
      const text = await readFile(file, "utf8");
      const start = text.indexOf(needle);
      expect(start).toBeGreaterThan(-1);
      expect(text.slice(start, start + 200)).toContain("if (!baseUrl) throw new Error");
    }
  });

  // QA round 67: desktop AI discovery added to the watchlist but never marked
  // the product tracked, so the catalog row kept offering "Add".
  it("marks a discovered product tracked in desktop Search", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    const start = text.indexOf("const handleDiscover");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [query, discovering, navigate]);", start));
    expect(block).toContain("setTrackedIds((prev) => new Set([...prev, res.product.id]))");
  });

  // QA round 63: the desktop reminder / restock-watch handlers had no
  // double-submit guard (each mints a fresh random id).
  it("guards desktop reminder/watch creation against double-submit", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("const [savingReminder, setSavingReminder] = useState(false)");
    for (const handler of [
      "const handleSetReminder",
      "const handleInlineReminder",
      "const handleWatchRestock",
      "const handleToggleListingWatch",
    ]) {
      const start = text.indexOf(handler);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, start + 1800);
      expect(block).toContain("savingReminder");
      expect(block).toContain("setSavingReminder(true)");
      expect(block).toContain("setSavingReminder(false)");
    }
  });

  // QA round 61: the desktop product-detail alert flows had no double-submit
  // guard (mobile was fixed in Phase 312).
  it("guards desktop product-detail alert creation against double-submit", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("const [creatingAlert, setCreatingAlert] = useState(false)");
    for (const handler of [
      "const handleSaveAlert",
      "const handleInlineAlert",
      "const handlePerListingAlert",
      "const handleQuickAlert",
    ]) {
      const start = text.indexOf(handler);
      expect(start).toBeGreaterThan(-1);
      // Take a generous window up to the next handler / render boundary.
      const block = text.slice(start, start + 1600);
      expect(block).toContain("creatingAlert");
      expect(block).toContain("setCreatingAlert(true)");
      expect(block).toContain("setCreatingAlert(false)");
    }
  });

  // QA round 59: the desktop Compare cross-alert had no double-submit guard.
  it("guards the desktop compare cross-alert against double-submit", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("const [creatingAlert, setCreatingAlert] = useState(false)");
    const start = text.indexOf("const handleCrossAlert");
    const block = text.slice(start, text.indexOf("}, [id, product, alertTarget", start));
    expect(block).toContain("creatingAlert");
    expect(block).toContain("setCreatingAlert(true)");
    expect(block).toContain("setCreatingAlert(false)");
  });

  // QA round 58: desktop pages accessed `product.listings.<method>` without the
  // `?? []` guard mobile uses, so a product with no listings crashed the page.
  it("guards desktop product.listings access with ?? []", async () => {
    const files = [
      "desktop/src/pages/Home.tsx",
      "desktop/src/pages/Watchlist.tsx",
      "desktop/src/pages/Stats.tsx",
      "desktop/src/pages/Compare.tsx",
      "desktop/src/pages/ProductDetail.tsx",
      "desktop/src/pages/Settings.tsx",
    ];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      // No bare `X.listings.<method>` (the optional-chained `?.listings` is
      // fine). `j.listings` is a job object built with `?? []` at construction.
      const bare = (text.match(/[A-Za-z_$][\w$]*\.listings\.(some|map|filter|find|reduce|length|forEach)/g) ?? [])
        .filter((m) => !m.startsWith("j.listings"));
      expect(bare).toEqual([]);
    }
  });

  // QA round 57: desktop Home computed pendingTags/pendingTagsArray/
  // pendingTagsSize and immediately voided them — dead work on every render.
  it("has no dead pendingTags computation in desktop Home", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    expect(text).not.toContain("pendingTags");
    expect(text).not.toContain("void pendingTags");
  });

  // QA round 55: the desktop CSV import counted every non-throwing
  // addToWatchlist as added, overstating the summary on duplicates (mobile was
  // fixed in Phase 270).
  it("counts only real inserts in the desktop CSV import", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const start = text.indexOf("const handleImportFile");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [refresh, showToast]);", start));
    expect(block).toMatch(/if \(await storage\.addToWatchlist\(/);
    expect(block).toContain("duplicates");
    expect(block).toContain("already tracked");
  });

  // QA round 48: unguarded storage.then chains rejected unhandled on a storage
  // failure. Each must have a .catch.
  it("guards desktop storage.then chains with .catch", async () => {
    const cases: Array<[string, string]> = [
      ["desktop/src/pages/Alerts.tsx", "storage\n      .getWatchlist()"],
      ["desktop/src/pages/Alerts.tsx", "storage\n      .getSettings()"],
      ["desktop/src/pages/Watchlist.tsx", "storage.getSettings().then((s) => {"],
      ["desktop/src/components/TrendingSection.tsx", "storage.getWatchlist().then((w) => {"],
      ["desktop/src/components/SearchModal.tsx", "storage.getWatchlist().then((products) =>"],
    ];
    for (const [file, needle] of cases) {
      const text = await readFile(file, "utf8");
      const start = text.indexOf(needle);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, start + 900);
      expect(block).toContain(".catch(");
    }
  });
});
