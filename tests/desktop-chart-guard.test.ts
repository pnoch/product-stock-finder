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

  // QA round 122: desktop built the drop-calendar day keys with fixed 24h
  // steps, so a near-midnight anchor skipped the 23h spring-forward day and its
  // drops vanished. It must use the shared calendar-date helper.
  it("uses the shared calendar-date helper for desktop drop-calendar keys", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("buildGridCells");
    expect(text).not.toMatch(/now - i \* 24 \* 60 \* 60 \* 1000/);
  });

  // QA round 121: desktop rendered raw responseTimeMs, so a probe that spanned
  // an Android suspension showed a minutes-long "response time". Mobile
  // sanitizes it (Phase 262).
  it("sanitizes response times in desktop health views", async () => {
    for (const file of [
      "desktop/src/pages/Health.tsx",
      "desktop/src/pages/HealthDetail.tsx",
    ]) {
      const text = await readFile(file, "utf8");
      expect(text).toContain("sanitizeResponseTimeMs");
      // No bare `X.responseTimeMs ?` interpolation.
      expect(text).not.toMatch(/[A-Za-z_$][\w$]*\.responseTimeMs \?/);
    }
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

  // QA round 128: desktop's notification list never routed digest events
  // (mobile's notificationRouteFor sends type "digest" → /stats) and dropped
  // health events that lacked a distributorId, so those rows weren't clickable.
  it("routes digest and health notifications in the desktop list", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    const start = text.indexOf("const route =");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("const itemClassName", start));
    expect(block).toContain('n.type === "digest"');
    expect(block).toContain('"/stats"');
    expect(block).toMatch(/n\.type === "health"[\s\S]*?"\/health"/);
  });

  // QA round 127: desktop's health list colored rows by raw status, so a probe
  // whose reason classifies as a block (Cloudflare interstitial) showed as a
  // hard error/working color. Mobile's resolveStatusColor shows those amber.
  it("resolves blocked-classified reasons to warning on desktop health", async () => {
    const text = await readFile("desktop/src/pages/Health.tsx", "utf8");
    expect(text).toContain("classifyFetchStatus");
    expect(text).toMatch(/const resolveStatusColor = \(h: DistributorHealth\)/);
    expect(text).not.toMatch(/backgroundColor: statusColors\[h\.status\]/);
    expect(text).not.toMatch(/color: statusColors\[h\.status\]/);
  });

  // QA round 157: mobile's DigestCard header reads "Digest — {periodLabel}"
  // ("this week"/"today"); desktop's read just "Digest".
  it("labels the desktop digest period", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toMatch(/Digest — \{digestFrequency === "weekly" \? "this week" : "today"\}/);
  });

  // QA round 156: mobile's StockHealthCard header reads "Stock Health (N
  // listings)"; desktop's dedicated Stock Health card header omitted the count.
  it("shows the listing count in the desktop stock-health header", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toMatch(/Stock Health\{stockHealth \? ` \(\$\{stockHealth\.totalListings\} listing/);
  });

  // QA round 155: mobile's BasketValueCard labels it "Basket Value (best
  // in-stock prices)" and shows the excluded count; desktop's Stats card showed
  // neither.
  it("labels and details the desktop basket value card", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("Basket Value (best in-stock prices)");
    expect(text).toContain("excluded (no stock)");
  });

  // QA round 154: desktop labelled the watchlist summary "Total Value", but the
  // shared computeWatchlistSummary sums every listing (all statuses) — mobile
  // correctly labels it "All Listings Value".
  it("labels the desktop watchlist summary All Listings Value", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("All Listings Value");
    expect(text).not.toContain("Total Value");
  });

  // QA round 153: mobile's WatchlistHeader has an "Add product" (+) button;
  // desktop's Watchlist header had none.
  it("has an Add Product button in the desktop watchlist header", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toMatch(/aria-label="Add product"/);
    expect(text).toMatch(/navigate\("\/search"\)/);
  });

  // QA round 152: desktop's drop-calendar grid laid 30 consecutive days into a
  // 7-column grid with no leading blanks, so the columns drifted off weekday
  // alignment (mobile's buildGridCells pads by the first day's weekday).
  it("aligns the desktop drop calendar to weekdays", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("buildGridCells");
    expect(text).toMatch(/dropCalendarCells\.map/);
    expect(text).not.toMatch(/last30DayKeys\.map/);
  });

  // QA round 151: mobile's DataFreshnessCard shows "Avg data points / listing"
  // and StockHealthCard shows "Back-order everywhere"; desktop's Stats omitted
  // both rows.
  it("shows the full freshness and stock-health rows on desktop Stats", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("Avg data points / listing");
    expect(text).toContain("back-order everywhere");
  });

  // QA round 150: mobile's compare screen exports the price history as CSV;
  // desktop's had only Share / Save image.
  it("exports price history CSV from the desktop compare screen", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("priceHistoryToCsv");
    expect(text).toContain("handleExportCsv");
    expect(text).toContain("Export price history as CSV");
  });

  // QA round 149: mobile's distributor-analysis screen exports the detailed
  // listings CSV; desktop's page had no export.
  it("exports CSV from the desktop distributor analysis", async () => {
    const text = await readFile("desktop/src/pages/DistributorAnalysis.tsx", "utf8");
    expect(text).toContain("watchlistToDetailedCsv");
    expect(text).toContain("Export CSV");
    expect(text).toContain("handleExport");
  });

  // QA round 148: mobile's StockWatchCard shows a "👀 Watching" badge; desktop's
  // Stock Watches rows showed only the status badge.
  it("shows the Watching badge on desktop stock watches", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain("👀 Watching");
  });

  // QA round 147: desktop's "Test notification" only called
  // displayWebNotification (a no-op in a Tauri webview), never the
  // sendDesktopNotification path real alerts use.
  it("tests the real notification path on desktop", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const start = text.indexOf("const handleTestNotification = useCallback");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, []);", start));
    expect(block).toContain("sendDesktopNotification");
    expect(block).not.toContain("displayWebNotification(");
  });

  // QA round 146: mobile's compare cross-alert checks notification permission
  // before creating the alert; desktop's handleCrossAlert saved it regardless,
  // so it could never notify.
  it("checks notification permission in the desktop compare cross-alert", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const start = text.indexOf("const handleCrossAlert = useCallback");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [id, product, alertTarget", start));
    expect(block).toContain("checkNotificationPermission");
    expect(block).toContain("Enable notifications to receive price alerts.");
  });

  // QA round 145: mobile's handleToggleStockWatch checks notification
  // permission before creating a restock watch; desktop's handleWatchRestock
  // and handleToggleListingWatch saved the watch regardless, so it could never
  // fire a notification.
  it("checks notification permission before creating desktop restock watches", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    for (const fn of ["const handleWatchRestock = async () => {", "const handleToggleListingWatch = async ("]) {
      const start = text.indexOf(fn);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, text.indexOf("\n  };", start));
      expect(block).toContain("checkNotificationPermission");
      expect(block).toContain("Enable notifications to watch for restocks.");
    }
  });

  // QA round 144: the server caps device labels at 64 chars and mobile's rename
  // modal sets maxLength={64}, but desktop's rename input had no cap — a longer
  // label made the server reject the rename.
  it("caps the desktop device label at 64 chars", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const start = text.indexOf('placeholder="Device label"');
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start - 300, start);
    expect(block).toContain("maxLength={64}");
  });

  // QA round 143: mobile's NotesCard caps the note at maxLength={500}; desktop's
  // note textarea had no cap.
  it("caps the desktop product note at 500 chars", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = text.indexOf('aria-label="Product note"');
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start - 500, start);
    expect(block).toContain("maxLength={500}");
  });

  // QA round 142: mobile's TargetTableCard shows a product-wide alert footer
  // ("Any distributor · target …") and an empty-state hint; desktop's
  // Distributor Targets section showed neither.
  it("shows the product-wide target footer on desktop", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Any distributor · target");
    expect(text).toContain("Set per-distributor targets with + to compare them here.");
  });

  // QA round 141: mobile's price-alert modal shows suggested target prices
  // (Near low / Below avg / Under current) via suggestAlertPrices; desktop's
  // modal had none.
  it("shows alert price suggestions in the desktop alert modal", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("suggestAlertPrices");
    expect(text).toMatch(/alertSuggestions\.map\(\(s\) =>/);
    expect(text).toMatch(/setAlertPrice\(String\(s\.price\)\)/);
  });

  // QA round 139: desktop's server-notification pull never tracked displayed
  // event ids, so every sync reconciled every event — a replay deleted a
  // watch/reminder the user re-created after the first delivery. Mobile tracks
  // displayedIds and skips reconciliation for already-delivered events.
  it("skips reconciliation for already-delivered events on desktop", async () => {
    const text = await readFile("desktop/src/server-notifications.ts", "utf8");
    expect(text).toContain("getDisplayedEventIds");
    expect(text).toContain("recordDisplayedEventId");
    expect(text).toMatch(/if \(!displayedIds\.has\(event\.id\)\) \{\s*await reconcileEvent\(event\);/);
  });

  // QA round 138: mobile's edit sheet requires both name and model non-empty
  // (canSave); desktop's Save only checked the name, so a blank model silently
  // kept the old one while the UI implied it changed.
  it("requires name and model in the desktop edit modal", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = text.indexOf("const handleSaveEdit = async () =>");
    const block = text.slice(start, text.indexOf("const handleSaveAlert", start));
    expect(block).toMatch(/if \(!editName\.trim\(\) \|\| !editModel\.trim\(\)\) return;/);
    const btn = text.slice(text.indexOf("aria-label=\"Save product changes\"") - 700, text.indexOf("aria-label=\"Save product changes\""));
    expect(btn).toMatch(/!editName\.trim\(\) \|\|\s*!editModel\.trim\(\)/);
  });

  // QA round 137: mobile's Edit Product sheet warns that changing the model
  // re-matches listings on the next refresh; desktop's edit modal didn't.
  it("warns when the model changes in the desktop edit modal", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Model changed — listings will re-match on next refresh.");
    expect(text).toMatch(/editModel\.trim\(\) !== \(product\.modelNumber \?\? ""\)/);
  });

  // QA round 136: desktop's server-notification upload omitted modelNumber, so
  // manually added / rediscovered products (absent from the static catalog) got
  // no server-side notifications. Mobile sends it.
  it("sends modelNumber in the desktop server-notification upload", async () => {
    const text = await readFile("desktop/src/server-notifications.ts", "utf8");
    expect(text).toContain("modelByProductId");
    expect(text).toMatch(/modelNumber: modelByProductId\.get\(a\.productId\)/);
    expect(text).toMatch(/modelNumber: modelByProductId\.get\(w\.productId\)/);
    expect(text).toMatch(/modelNumber: modelByProductId\.get\(r\.productId\)/);
  });

  // QA round 135: desktop Stats computed the digest against a null snapshot
  // (treating every product as new) and rendered nothing when the digest was
  // enabled but no snapshot existed yet. Mobile returns null and shows a
  // "Digest scheduled" placeholder.
  it("shows a digest-scheduled placeholder on desktop Stats", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("digestPending");
    expect(text).toMatch(/setDigest\(snapshot \? computeDigest\(snapshot, list, settings, alerts\) : null\)/);
    expect(text).toContain("Digest scheduled");
  });

  // QA round 134: desktop Home's "Reminders" stat counted only date reminders,
  // but the Alerts tab it navigates to counts reminders + stock watches, so the
  // card understated the destination.
  it("counts stock watches in the desktop Home reminders stat", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    const start = text.indexOf("const loadDashboard = useCallback");
    const block = text.slice(start, text.indexOf("}, []);", start));
    expect(block).toContain("getStockWatches");
    expect(block).toMatch(/setReminderCount\(reminders\.length \+ stockWatches\.length\)/);
  });

  // QA round 133: desktop's "Lowest Price Ever" badge mapped unconvertible
  // prior points to Infinity, so an all-unconvertible history claimed "lowest
  // ever"; the compare selection sort also fell back to the raw price. Mobile
  // filters nulls and sorts unconvertible listings last.
  it("does not treat unconvertible prices as lowest-ever on desktop", async () => {
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = detail.indexOf("const isLowestEver = useMemo");
    const block = detail.slice(start, detail.indexOf("}, [bestListing, displayCurrency]);", start));
    expect(block).not.toContain("?? Infinity");
    expect(block).toMatch(/filter\(\(v\): v is number => v !== null\)/);
    const compare = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const selStart = compare.indexOf("const withHistory = (product.listings ?? [])");
    const selBlock = compare.slice(selStart, compare.indexOf("setSelected(new Set(withHistory.slice(0, 3)", selStart));
    expect(selBlock).not.toMatch(/convertPrice\([^)]*\) \?\? [ab]\.price/);
  });

  // QA round 132: desktop's Compare price sort and "Best Price" card fell back
  // to the raw price when a listing's currency couldn't be converted, mixing
  // currencies in the comparison. Mobile sorts unconvertible listings last.
  it("does not mix currencies in the desktop compare price sort", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const sortStart = text.indexOf('if (sortBy === "price")');
    expect(sortStart).toBeGreaterThan(-1);
    const sortBlock = text.slice(sortStart, text.indexOf('if (sortBy === "trend")', sortStart));
    expect(sortBlock).not.toMatch(/convertPrice\([^)]*\) \?\? a\.price/);
    expect(sortBlock).toMatch(/if \(pa === null\) return 1/);
    const cheapStart = text.indexOf("const cheapest = useMemo");
    const cheapBlock = text.slice(cheapStart, text.indexOf("}, [sortedListings, displayCurrency]);", cheapStart));
    expect(cheapBlock).not.toMatch(/convertPrice\([^)]*\) \?\? (curr|best)\.price/);
  });

  // QA round 131: desktop's watchlist sort used `a.name.localeCompare` and
  // `new Date(...).getTime()` directly, so a malformed product (missing name /
  // invalid date) threw or produced a NaN comparator (implementation-defined
  // order). Mobile's sortWatchlist guards both.
  it("keeps desktop watchlist sort NaN-safe and name-guarded", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    const start = text.indexOf("const sorted = useMemo");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("}, [filtered, sortKey, sortAsc, displayCurrency, dealScores]);", start));
    expect(block).toMatch(/\(a\.name \?\? ""\)\.localeCompare\(b\.name \?\? ""\)/);
    expect(block).not.toMatch(/new Date\(a\.lastRefreshed/);
    expect(block).toMatch(/Date\.parse\(a\.lastRefreshed/);
  });

  // QA round 126: desktop's notification list always rendered health events
  // with the red warning icon/color, so a "recovered" event looked like an
  // ongoing outage. Mobile uses healthIcon/healthColor to show a green
  // checkmark for recoveries.
  it("renders recovered health notifications as success on desktop", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toMatch(/n\.type === "health" && n\.healthStatus === "recovered"/);
    expect(text).toMatch(/n\.healthStatus === "recovered" \? "bg-emerald-50/);
  });

  // QA round 125: desktop imported convertPrice/getBestPrice from
  // @shared/currency (static rates) in several views, bypassing the live FX
  // overlay that lib/currency.ts applies — so those views disagreed with
  // mobile (and desktop's own Home/Compare) once live rates loaded.
  it("converts prices through the live-rate lib/currency overlay on desktop", async () => {
    const files = [
      "desktop/src/pages/Watchlist.tsx",
      "desktop/src/pages/Stats.tsx",
      "desktop/src/pages/ProductDetail.tsx",
      "desktop/src/components/PriceHistoryChart.tsx",
    ];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      expect(text).toMatch(/import \{[^}]*\} from "@\/lib\/currency"/);
      // No convertPrice/getBestPrice pulled from the static shared module.
      const sharedImport = text.match(/import \{[^}]*\} from "@shared\/currency"/)?.[0] ?? "";
      expect(sharedImport).not.toContain("convertPrice");
      expect(sharedImport).not.toContain("getBestPrice");
    }
  });

  // QA round 123: desktop's Compare chart pushed `new Date(p.date).getTime()`
  // into allDates without filtering NaN, so one invalid date made minDate/
  // dateRange NaN and blanked the chart. Mobile's MultiLineChart filters it.
  it("filters invalid dates in the desktop compare chart", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toMatch(/if \(!Number\.isNaN\(t\)\) allDates\.push\(t\)/);
    expect(text).not.toMatch(/for \(const p of s\.data\) allDates\.push\(new Date\(p\.date\)\.getTime\(\)\)/);
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
      const block = text.slice(start, start + 2400);
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
