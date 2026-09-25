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
    const block = text.slice(start, text.indexOf("const handleToggleProductTag", start));
    expect(block).toContain("storage.getAlerts()");
    expect(block).toContain("showUndoBar(product, removedAlerts, removedReminders, removedWatches)");
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
    const start = text.indexOf("Target: {formatPrice(alert.targetPrice");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("Triggered on", start));
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

  // QA round 246: mobile's device row shows relative last-seen ("last seen 2h
  // ago"); desktop showed an absolute date, losing recency.
  it("uses relative last-seen on the desktop device list", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("formatLastSeen(d.lastSeenAt)");
    expect(text).not.toContain("Active {new Date(d.lastSeenAt)");
  });

  // QA round 245: mobile's alert-card uses month-name dates for "Snoozed
  // until" and "Triggered"; desktop used bare toLocaleDateString().
  it("formats alert-card dates like mobile on desktop", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toMatch(
      /Snoozed until \{new Date\(alert\.snoozedUntil!\)\.toLocaleDateString\(undefined, \{ month: "short", day: "numeric" \}\)/,
    );
    expect(text).toMatch(
      /Triggered on \{new Date\(alert\.triggeredAt!\)\.toLocaleDateString\(undefined/,
    );
    expect(text).toMatch(
      /Created\{" "\}\s*\{new Date\(alert\.createdAt\)\.toLocaleDateString\(undefined/,
    );
  });

  // QA round 244: mobile's reminder card renders "Jan 5, 2026"; desktop's used
  // bare toLocaleDateString() → locale-numeric "1/5/2026" for the same date.
  it("formats reminder dates like mobile on desktop", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain('month: "short"');
    expect(text).toContain('"Was due " : "Remind on "');
  });

  // QA round 242: mobile highlights the selected drop-calendar day; desktop
  // only set aria-pressed, so a click gave no visual selection feedback.
  it("highlights the selected drop-calendar day on desktop", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toMatch(
      /selectedKey === key\s*\?\s*"bg-brand-600 text-white ring-2 ring-brand-400"/,
    );
  });

  // QA round 238: mobile's drop-calendar count reads "N price drops in the last
  // 30 days"; desktop's said "N drops in 30 days".
  it("matches mobile's drop-calendar count text on desktop", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("price drop{dropCalendar.totalDrops === 1 ? \"\" : \"s\"} in the last 30 days");
  });

  // QA round 237: mobile's movers empty state adds "Not enough price history
  // yet."; desktop's said only "No movers yet".
  it("adds the movers empty-state subtitle on desktop", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("Not enough price history yet.");
  });

  // QA round 236: mobile's product card has an "Edit tags" action per product;
  // desktop's watchlist row had no per-product tag assignment.
  it("has a per-product tag picker on the desktop watchlist", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toMatch(/aria-label=\{`Edit tags for \$\{product\.name\}`\}/);
    expect(text).toContain("handleToggleProductTag");
    expect(text).toContain("setProductTags");
  });

  // QA round 235: mobile's "Enable Notifications" row has the description
  // "Receive alerts on your device"; desktop's had none.
  it("describes the desktop enable-notifications row", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Receive alerts on your device");
  });

  // QA round 234: mobile's device row marks the current device with a "This
  // device" badge; desktop appended " (current)" to the label.
  it("marks the desktop current device like mobile", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("This device");
    expect(text).not.toContain("{isCurrent && \" (current)\"}");
  });

  // QA round 233: mobile's Home still shows Trending with an empty watchlist so
  // a new user can discover products; desktop's empty state hid it.
  it("shows Trending in the desktop empty-watchlist Home", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    const start = text.indexOf("if (products.length === 0) {");
    const block = text.slice(start, text.indexOf("\n  }\n", start));
    expect(block).toContain("<TrendingSection />");
  });

  // QA round 232: mobile's trending section shows "Couldn't load" + "Retry" on
  // fetch failure; desktop swallowed the error and hid the section.
  it("shows a trending retry state on desktop", async () => {
    const text = await readFile("desktop/src/components/TrendingSection.tsx", "utf8");
    expect(text).toContain("Couldn&apos;t load");
    expect(text).toContain('aria-label="Retry loading trending"');
    expect(text).toContain("loadError");
  });

  // QA round 254: desktop copy used mobile's "tap" wording in Health/Home/Alerts
  // (the Home hint also referenced a "+" control the desktop doesn't have).
  it("uses desktop click wording instead of mobile tap", async () => {
    const health = await readFile("desktop/src/pages/Health.tsx", "utf8");
    const home = await readFile("desktop/src/pages/Home.tsx", "utf8");
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(health).toContain('Click &quot;Test All Distributors&quot; to run a check.');
    expect(home).toContain("Click Add Product to add a product to your watchlist");
    expect(alerts).toContain('Open a product and click "Set Alert"');
    expect(alerts).toContain(
      'Open a back-order product listing and click "Remind me" or "Watch for Restock"',
    );
    for (const text of [health, home, alerts]) {
      expect(text.toLowerCase()).not.toContain("tap ");
    }
  });

  // QA round 253: mobile's Compare CSV export bails with "Nothing to export"
  // when no listing has price history; desktop wrote a header-only CSV and
  // reported success.
  it("guards the desktop compare CSV export against empty history", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const start = text.indexOf("const handleExportCsv");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("const getTrend", start));
    expect(block).toContain("withHistory.length === 0");
    expect(block).toContain('"Nothing to export');
  });

  // QA round 252: mobile renders trending prices with formatPrice; desktop used
  // a local currencySymbol map (USD/EUR/GBP only) + toLocaleString() (no fixed
  // decimals), so non-major currencies and cents rendered differently.
  it("formats trending prices with formatPrice on desktop", async () => {
    const text = await readFile("desktop/src/components/TrendingSection.tsx", "utf8");
    expect(text).toContain("formatPrice(product.estimatedPrice, product.currency)");
    expect(text).not.toContain("currencySymbol(");
  });

  // QA round 231: mobile's DigestCard has "Price Changes", "Stock Changes", and
  // "🎯 Targets Hit" section headers; desktop's digest card lacked them.
  it("adds the desktop digest section headers", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain(">Price Changes</p>");
    expect(text).toContain(">Stock Changes</p>");
    expect(text).toContain(">🎯 Targets Hit</p>");
  });

  // QA round 230: mobile's StockHealthCard shows "Listings in stock" / "Fully
  // out of stock" / "Back-order everywhere" columns; desktop used a compressed
  // single line.
  it("matches mobile's stock-health labels on desktop", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("Listings in stock");
    expect(text).toContain("Fully out of stock");
    expect(text).toContain("Back-order everywhere");
  });

  // QA round 247: mobile formats the freshness "Oldest check" date
  // (month-name) and health sample timestamps (month-name + 2-digit time);
  // desktop used bare toLocaleDateString()/toLocaleString().
  it("formats freshness and health sample dates like mobile on desktop", async () => {
    const stats = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(stats).toMatch(
      /new Date\(freshness\.oldestCheck\)\.toLocaleDateString\(undefined, \{\s*month: "short",\s*day: "numeric",\s*year: "numeric",\s*\}\)/,
    );

    const health = await readFile("desktop/src/pages/HealthDetail.tsx", "utf8");
    expect(health).toContain(
      'new Date(s.at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })',
    );
  });

  // QA round 229: mobile's freshness labels are "Stale (>7 days)" and "Oldest
  // check"; desktop's were "Stale" and "Oldest update".
  it("matches mobile's freshness labels on desktop", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("Stale (&gt;7 days):");
    expect(text).toContain("Oldest check");
    expect(text).not.toContain("Oldest update");
  });

  // QA round 228: mobile's basket alert sheet title is "🧺 Basket Value Alert";
  // desktop's was "Basket Value Alert".
  it("titles the desktop basket alert modal like mobile", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("🧺 Basket Value Alert");
  });

  // QA round 227: mobile's "Dropping now" count uses colors.primary; desktop's
  // was gray.
  it("colors the desktop Dropping now count like mobile", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    const start = text.indexOf(">Dropping now</p>");
    const block = text.slice(start - 200, start);
    expect(block).toContain("text-brand-600 dark:text-brand-400");
  });

  // QA round 226: mobile's mover change is a colored pill; desktop's was plain
  // text.
  it("renders the desktop mover change as a pill", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-2 py-0.5");
    expect(text).toContain("text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5");
  });

  // QA round 225: mobile's mover headers are "▼ Top Drops" (green) and
  // "▲ Top Gainers" (red); desktop's were plain gray "Top Drops"/"Top Gainers".
  it("matches mobile's mover headers on desktop", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("▼ Top Drops");
    expect(text).toContain("▲ Top Gainers");
  });

  // QA round 224: mobile's drop-calendar cells show the day-of-month (count in
  // the label); desktop's drop cells showed the drop count.
  it("shows the day number in desktop drop-calendar cells", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    const start = text.indexOf("dropCalendarCells.map((ts, i) => {");
    const block = text.slice(start, start + 1400);
    expect(block).not.toMatch(/>\s*\{dropCount\}\s*<\/button>/);
    expect(block).toMatch(/\{Number\(key\.slice\(8, 10\)\)\}/);
  });

  // QA round 223: mobile's DetailHeader subline is "{brand} · {category} ·
  // {modelNumber}"; desktop's was "{brand} | {modelNumber} | {category}".
  it("matches mobile's product header subline on desktop", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("{product.brand} · {product.category} · {product.modelNumber}");
  });

  // QA round 222: mobile's BestDistributorCard shows a "Cheapest in-stock
  // option" (etc.) subtitle; desktop's Best Price card omitted it.
  it("explains the desktop best-price card like mobile", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Cheapest in-stock option");
    expect(text).toContain("Cheapest orderable option");
    expect(text).toContain("Cheapest available option");
  });

  // QA round 221: mobile's ChartCard offers 6M/1Y ranges and shows "Select up
  // to 5 distributors to overlay" plus range hints; desktop only had 1W/1M/3M/
  // All and no hints.
  it("adds the 6M/1Y ranges and chart hints on desktop compare", async () => {
    // Round 265 derives the chips from TIME_RANGES (1W/1M/3M/6M/1Y/All) instead
    // of the previous hard-coded key/label list.
    const chips = await readFile("desktop/src/components/TimeRangeChips.tsx", "utf8");
    expect(chips).toContain("TIME_RANGES.map");
    expect(chips).toContain("const key = range.toLowerCase()");
    const compare = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(compare).toContain("Select up to 5 distributors to overlay");
    expect(compare).toContain("Showing all available history — up to 1Y retained (older points may be limited)");
  });

  // QA round 220: mobile's distributor sort chips are "Trend ▼" / "Price" /
  // "A–Z"; desktop's were "Name" / "Price" / "Trend".
  it("matches mobile's distributor sort labels on desktop", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("A–Z");
    expect(text).toContain("Trend ▼");
  });

  // QA round 219: mobile's cross-alert card says "Alert me if any distributor
  // drops below" / "{price} (5% below current best of {best})"; desktop's said
  // "Alert me below {target}" / "5% below the best in-stock price, any
  // distributor".
  it("matches mobile's cross-alert copy on desktop", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("Alert me if any distributor drops below");
    expect(text).toContain("(5% below current best of {formatPrice(crossBest, displayCurrency)})");
  });

  // QA round 218: mobile's healthColor returns "warning" (amber) for
  // non-recovered health events; desktop colored them red.
  it("colors non-recovered desktop health notifications amber", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toMatch(/n\.healthStatus === "recovered" \? "bg-emerald-50[^"]*" : "bg-amber-50/);
    expect(text).not.toMatch(/n\.healthStatus === "recovered" \? "bg-emerald-50[^"]*" : "bg-red-50/);
  });

  // QA round 217: mobile's Home stat labels are "Tracked" and "Alerts";
  // desktop's were "Total Tracked" and "Alerts Active".
  it("matches mobile's Home stat labels on desktop", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    expect(text).toContain('label="Tracked"');
    expect(text).toContain('label="Alerts"');
    expect(text).not.toContain("Total Tracked");
    expect(text).not.toContain("Alerts Active");
  });

  // QA round 216: mobile shows "Local-only mode — prices are fetched on this
  // device" when the server isn't configured; desktop always said "Sign in to
  // sync across devices".
  it("shows the desktop local-only sync status when unconfigured", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Local-only mode — prices are fetched on this device");
  });

  // QA round 215: mobile surfaces a failed sync via formatSyncStatus
  // (lastSyncError); desktop's inline sync status always showed the
  // last-success time and hid errors.
  it("surfaces sync errors on desktop via formatSyncStatus", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toMatch(/formatSyncStatus\(syncMeta, isAuthenticated, now\)/);
    expect(text).toContain("syncStatus.label");
    expect(text).not.toMatch(/const syncStatus = !isAuthenticated/);
  });

  // QA round 214: mobile's filtered-empty watchlist state says "No products
  // match your filters" with guidance; desktop's said "No products match this
  // filter." with none.
  it("matches mobile's filtered-empty watchlist copy on desktop", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("No products match your filters");
    expect(text).toContain("Try adjusting your filters or search — or add a new product to track.");
  });

  // QA round 213: mobile's watchlist no-products state is "No products yet"
  // with the "track … across 25 distributors" description, a tip, and a
  // Browse Products action; desktop's said "No products in watchlist".
  it("matches mobile's watchlist empty state on desktop", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain('title="No products yet"');
    expect(text).toContain("track their availability and prices globally across 25 distributors.");
    expect(text).toContain("Tip: Search for MikroTik CRS, Ubiquiti U7, RTX 4090, Pi 5, etc.");
  });

  // QA round 212: mobile's CompareHeader title is "Compare Prices"; desktop's
  // header showed the product name as the title.
  it("titles the desktop compare header Compare Prices", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toMatch(/<h1 className="text-2xl font-bold">Compare Prices<\/h1>/);
  });

  // QA round 211: mobile's compare has a "Current Prices" table (selected
  // listings with chart colors, converted prices, stock); desktop lacked it.
  it("shows the Current Prices table on desktop compare", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("Current Prices");
    expect(text).toContain("No distributors selected");
  });

  // QA round 210: mobile's CheapestRegionCard shows a per-row stock pill;
  // desktop's region rows showed only the price.
  it("shows a stock pill per region row on desktop compare", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toMatch(/<StockBadge status=\{item\.listing\.stockStatus\} \/>/);
  });

  // QA round 209: mobile's health-detail "Distributor not found" is an
  // EmptyStateView with a subtitle and a Go back CTA; desktop's was a plain line.
  it("matches mobile's health-detail not-found state on desktop", async () => {
    const text = await readFile("desktop/src/pages/HealthDetail.tsx", "utf8");
    expect(text).toContain("We couldn&apos;t find this distributor. Check the link or browse distributor health.");
    expect(text).toMatch(/aria-label="Go back to health"/);
  });

  // QA round 208: mobile distinguishes "No distributor health data" (with a
  // Test All Distributors CTA) from "No matches" (with a Show All CTA);
  // desktop showed the "no data" line whenever the filter matched nothing.
  it("splits the desktop health empty states like mobile", async () => {
    const text = await readFile("desktop/src/pages/Health.tsx", "utf8");
    expect(text).toContain("No distributor health data");
    expect(text).toContain("No matches");
    expect(text).toContain("No distributors match the selected filter.");
    expect(text).toMatch(/health\.length === 0 \?/);
  });

  // QA round 207: mobile's distributor-analysis empty state is "No distributor
  // data yet" with a subtitle, Browse Products CTA, and Try Again; desktop's was
  // a single "Add products to see distributor analysis." line.
  it("matches mobile's distributor-analysis empty state on desktop", async () => {
    const text = await readFile("desktop/src/pages/DistributorAnalysis.tsx", "utf8");
    expect(text).toContain("No distributor data yet");
    expect(text).toContain("compare coverage and average prices across distributors.");
    expect(text).toContain("Try Again");
  });

  // QA round 206: mobile's Home header shows "Product Stock Finder" /
  // "Global availability monitor"; desktop's said "Dashboard".
  it("matches mobile's Home header on desktop", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    expect(text).toContain("Product Stock Finder");
    expect(text).toContain("Global availability monitor");
    expect(text).not.toContain(">Dashboard</h1>");
  });

  // QA round 205: desktop rendered route-less notifications as a plain div, so
  // they could never be marked read individually; mobile's always-pressable
  // item marks read regardless of route.
  it("marks route-less desktop notifications read on click", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toMatch(/onClick=\{\(\) => void handleNotificationOpen\(n\)\}[\s\S]*?role="button"/);
  });

  // QA round 204: mobile's check-interval options are "Manual only" / "Every
  // hour" / "Once a day"; desktop's were "Manual" / "Hourly" / "Daily".
  it("labels the desktop check-interval options like mobile", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Manual only");
    expect(text).toContain("Every hour");
    expect(text).toContain("Once a day");
  });

  // QA round 203: desktop hardcoded the privacy URL and support email on a
  // domain lib/legal-links.ts warns may not be registered; mobile derives them
  // from the configured web base / EXPO_PUBLIC_SUPPORT_EMAIL.
  it("derives the desktop legal links from lib/legal-links", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("getPrivacyPolicyUrl()");
    expect(text).toContain("getSupportMailtoUrl()");
    expect(text).not.toContain("https://productstockfinder.app/privacy");
    expect(text).not.toContain("mailto:support@productstockfinder.app");
  });

  // QA round 202: mobile's data rows describe each action; desktop's buttons
  // had no descriptions (added as tooltips).
  it("describes the desktop data buttons", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Save watchlist as CSV (prices in display currency)");
    expect(text).toContain("Save watchlist, alerts and settings to a file");
    expect(text).toContain("Restore from a backup file (merges by id)");
  });

  // QA round 201: mobile's data buttons are "Export Backup" / "Import Backup";
  // desktop's were "Export full backup" / "Import backup".
  it("titles the desktop backup buttons like mobile", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Export Backup");
    expect(text).toContain("Import Backup");
    expect(text).not.toContain("Export full backup");
    expect(text).not.toContain("Import backup");
  });

  // QA round 200: mobile's connection button reads "Check Now"; desktop's said
  // "Check now".
  it("titles the desktop connection button like mobile", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain('"Checking" : "Check Now"');
  });

  // QA round 199: mobile's label is "Test Notification"; desktop's button said
  // "Test notification".
  it("titles the desktop test-notification button like mobile", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toMatch(/>\s*Test Notification\s*<\/button>/);
    expect(text).not.toMatch(/>\s*Test notification\s*<\/button>/);
  });

  // QA round 198: mobile's notification rows describe each alert type; desktop's
  // Stock/Price Alerts rows had no descriptions.
  it("describes the desktop notification toggles", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Notify when item comes in stock");
    expect(text).toContain("Notify when price drops below target");
    expect(text).toContain("Notify when a distributor is blocked or down");
  });

  // QA round 197: mobile's account-deletion button reads "Delete Account &
  // Data"; desktop's was "Delete account & data".
  it("titles the desktop account-deletion button like mobile", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Delete Account & Data");
    expect(text).not.toContain("Delete account & data");
  });

  // QA round 196: mobile's data section title is "Data"; desktop's was "Data
  // Management".
  it("titles the desktop data section Data", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain(">Data</h2>");
    expect(text).not.toContain("Data Management");
  });

  // QA round 195: mobile's settings section is "Collaborative Watchlist";
  // desktop's was "Share Watchlist".
  it("titles the desktop share section Collaborative Watchlist", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Collaborative Watchlist");
  });

  // QA round 194: mobile's stats empty-state CTA is "Browse Products" and Home's
  // is "Add Product"; desktop used "Add Products" for both.
  it("matches mobile's empty-state CTA labels on desktop", async () => {
    const stats = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(stats).toContain("Browse Products");
    const home = await readFile("desktop/src/pages/Home.tsx", "utf8");
    expect(home).toContain("Add Product");
    expect(home).not.toContain("Add Products");
  });

  // QA round 193: mobile's Home empty state says "No products tracked yet" and
  // shows a "Try: RTX 4090, Pi 5, CRS326, or U7 Pro Max" hint; desktop's said
  // "No products tracked" with no hint.
  it("matches mobile's Home empty state on desktop", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    expect(text).toContain('title="No products tracked yet"');
    expect(text).toContain("Try: RTX 4090, Pi 5, CRS326, or U7 Pro Max");
  });

  // QA round 192: mobile's alerts empty state is "No alerts set" / 'Open a
  // product and click "Set Alert"…'; desktop's was "No price alerts".
  // (Round 254 replaced mobile's "tap" with desktop's "click".)
  it("matches mobile's alerts empty-state copy on desktop", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain('title="No alerts set"');
    expect(text).toContain('Open a product and click "Set Alert" to get notified when the price drops.');
  });

  // QA round 271: chart colors were duplicated — mobile defined hashId in three
  // files and the desktop kept its own 8-color palette + selection-order
  // indexing (deselecting a distributor recolored the rest, and mobile/desktop
  // could disagree). All now use the shared distributorColor.
  it("assigns distributor colors from the shared helper", async () => {
    for (const file of [
      "app/compare/[id].tsx",
      "components/compare/current-prices-table.tsx",
      "components/compare/distributor-selector.tsx",
      "desktop/src/pages/Compare.tsx",
    ]) {
      const src = await readFile(file, "utf8");
      expect(src, file).toContain("distributorColor(");
      expect(src, file).not.toContain("hashId(");
    }
    const shared = await readFile("shared/src/compare-utils.ts", "utf8");
    expect(shared).toContain("export function distributorColor");
  });

  // QA round 268: mobile's restock-watch remove confirm names the product and
  // shows friendly error copy; the desktop used generic wording and the raw
  // storage error message.
  it("names the product in the desktop restock-watch confirm", async () => {
    const text = await readFile("desktop/src/pages/RestockWatches.tsx", "utf8");
    expect(text).toContain("Stop watching for ${productName}? This cannot be undone.");
    expect(text).toContain("We couldn't remove that watch. Please try again.");
    expect(text).toContain("handleRemove(watch.id, watch.productName)");
  });

  // QA round 267: mobile's DetailHeader shows an In Stock badge when a best deal
  // exists; the desktop product header omitted it.
  it("shows the in-stock badge in the desktop product header", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = text.indexOf("Product Header");
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("headerConversion", start));
    expect(block).toContain('<StockBadge status="in_stock" />');
  });

  // QA round 266: mobile exposes which chip is active on its filter/sort/theme/
  // direction pickers; several desktop single-select rows rendered an active
  // style with no aria state, so a screen reader couldn't tell what was chosen.
  it("exposes the active chip on desktop single-select rows", async () => {
    const chrome = await readFile("desktop/src/components/search-chrome.tsx", "utf8");
    expect(chrome).toContain("aria-pressed={selected === null}");
    expect(chrome).toContain("aria-pressed={active}");
    for (const file of [
      "desktop/src/pages/Search.tsx",
      "desktop/src/components/SearchModal.tsx",
    ]) {
      expect(await readFile(file, "utf8")).toContain("aria-pressed={active}");
    }
    const product = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(product).toContain("aria-pressed={regionFilter === region}");
    expect(product).toContain("aria-pressed={alertDirection === dir}");
    expect(product).toContain("aria-pressed={perListingAlertDirection === dir}");
    expect(product).toContain("aria-pressed={inlineAlertDirection === dir}");
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(alerts).toContain("aria-pressed={editCurrency === c}");
    expect(alerts).toContain("aria-pressed={editDirection === d}");
    expect(alerts).toContain("aria-pressed={editDistributorId == null}");
    const compare = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(compare).toContain('aria-pressed={sortBy === "name"}');
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(settings).toContain("aria-pressed={settings.theme === t}");
    expect(settings).toContain("aria-pressed={settings.checkInterval === value}");
    expect(settings).toContain('aria-pressed={(settings.digestFrequency ?? "off") === freq}');
    expect(settings).toContain("aria-pressed={DAY_LABELS[settings.digestDayOfWeek ?? 0] === day}");
  });

  // QA round 265: mobile's range chips expose the selected range
  // (accessibilityRole="radio" + accessibilityState.selected); the desktop's had
  // no selected state and hard-coded the list instead of using TIME_RANGES.
  it("exposes the selected time range on the desktop chips", async () => {
    const text = await readFile("desktop/src/components/TimeRangeChips.tsx", "utf8");
    expect(text).toContain("TIME_RANGES");
    expect(text).toContain('role="radio"');
    expect(text).toContain("aria-checked={selected === key}");
  });

  // QA round 262: undo after removing a product restored only the product and
  // its alerts; the removal cascade also deletes back-order reminders and
  // restock watches, which were silently lost.
  it("restores reminders and restock watches on undo", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("undoRemindersRef");
    expect(text).toContain("undoWatchesRef");
    expect(text).toContain("await storage.addBackOrderReminder(reminder)");
    expect(text).toContain("await storage.addStockWatch(watch)");
    expect(text).toContain("removedReminders");
    expect(text).toContain("removedWatches");
  });

  // QA round 260: mobile's shared watchlist says "+N more distributors" and
  // shows "No distributor prices yet" for products without listings; the
  // desktop said "+N more" and rendered nothing for an empty listing list.
  it("matches mobile's shared-watchlist listing copy on desktop", async () => {
    const text = await readFile("desktop/src/pages/SharedWatchlist.tsx", "utf8");
    expect(text).toContain("more distributors</p>");
    expect(text).toContain("No distributor prices yet");
  });

  // QA round 251: mobile's watchlist preview link reads "View all N products →";
  // desktop's omitted the noun ("View all N →").
  it("labels the desktop Home watchlist link like mobile", async () => {
    const text = await readFile("desktop/src/pages/Home.tsx", "utf8");
    expect(text).toContain(
      'View all {products.length} product{products.length === 1 ? "" : "s"} →',
    );
  });

  // QA round 250: mobile's restock-watches empty state promises "to get
  // notified when it's back in stock"; desktop's said only "to add one".
  it("matches the restock-watches empty-state outcome on desktop", async () => {
    const text = await readFile("desktop/src/pages/RestockWatches.tsx", "utf8");
    expect(text).toContain("to get notified when it&apos;s back in stock.");
  });

  // QA round 249: mobile's tab switcher omits a zero count ("Alerts", not
  // "Alerts (0)"); desktop always rendered the count on Alerts/Reminders.
  it("omits zero tab counts on the desktop alerts tabs", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain('Alerts{activeAlertCount > 0 ? ` (${activeAlertCount})` : ""}');
    expect(text).toContain(
      'Reminders{reminders.length + watches.length > 0 ? ` (${reminders.length + watches.length})` : ""}',
    );
  });

  // QA round 191: mobile's reminders headers are "Watching for Restock (N)" and
  // "Date Reminders (N)"; desktop's were "Stock Watches" / "Date Reminders"
  // without counts.
  it("labels the desktop reminder sections with counts", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain("Watching for Restock ({watches.length})");
    expect(text).toContain("Date Reminders ({reminders.length})");
    expect(text).not.toContain("Stock Watches");
  });

  // QA round 190: mobile's triggered section header is "Alert History (N)";
  // desktop's was "Price Drop History (N)".
  it("labels the desktop triggered section Alert History", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain("Alert History ({triggeredAlerts.length})");
    expect(text).not.toContain("Price Drop History");
  });

  // QA round 189: mobile's compare toggleSelect toasts when the 5-distributor
  // cap is hit; desktop silently ignored the click.
  it("warns when the desktop compare selection cap is reached", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("You can compare up to 5 distributors");
    expect(text).toMatch(/const handleToggleSelect = useCallback/);
    expect(text).toMatch(/onClick=\{\(\) => handleToggleSelect\(listing\.distributorId\)\}/);
  });

  // QA round 188: mobile's empty region state offers a "Show All" button;
  // desktop's "No distributors in {region}." had none.
  it("offers Show All in the desktop empty region state", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toMatch(/aria-label="Show all regions"/);
    expect(text).toContain('setRegionFilter("all")');
  });

  // QA round 187: mobile's DetailHeader shows the product region; desktop's
  // header omitted it.
  it("shows the product region on the desktop header", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Mobile's DetailHeader shows the product region");
    expect(text).toMatch(/d\.id === bestDeal\.distributorId\)\?\.region/);
  });

  // QA round 186: mobile's ProductInfoCard shows Distributors / In Stock /
  // Best Price; desktop's header only had the Best Price card.
  it("shows the Distributors and In Stock stats on desktop", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Stats row — mobile's ProductInfoCard");
    expect(text).toMatch(/>Distributors</);
    expect(text).toMatch(/>In Stock</);
  });

  // QA round 185: mobile's ProductInfoCard colors "Last refreshed" by freshness;
  // desktop's header showed "Updated …" in plain gray.
  it("colors the desktop last-refreshed text", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Last refreshed: {formatLastRefreshed(iso)}");
    expect(text).toMatch(/getLastRefreshedColor\(iso\)/);
  });

  // QA round 184: mobile's NotesCard empty state says "Add a private note…";
  // desktop's said "No note yet.".
  it("uses mobile's empty note text on desktop", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Add a private note…");
    expect(text).not.toContain("No note yet.");
  });

  // QA round 183: mobile's NotesCard placeholder is "Private note (only visible
  // on this device)…"; desktop's said "Add a note about this product…".
  it("uses mobile's note placeholder on desktop", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Private note (only visible on this device)…");
  });

  // QA round 182: mobile's per-distributor target flow uses the same
  // PriceAlertModal with suggestion chips; desktop's dedicated "Set Distributor
  // Alert" modal had none.
  it("shows suggestions in the desktop distributor alert modal", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("perListingAlertSuggestions");
    expect(text).toMatch(/perListingAlertSuggestions\.map\(\(s\) =>/);
  });

  // QA round 181: mobile's EditProductSheet title is "Edit Product ✏️";
  // desktop's edit-product modal was "Edit product".
  it("titles the desktop edit-product modal like mobile", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain('title="Edit Product ✏️"');
    expect(text).not.toContain('title="Edit product"');
  });

  // QA round 180: mobile's ReminderDatePickerModal title is "Set Reminder 📅";
  // desktop's was "Set Reminder".
  it("titles the desktop reminder modal like mobile", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain('title="Set Reminder 📅"');
  });

  // QA round 179: desktop's re-enable only refreshed lastChecked and never
  // cleared the circuit breaker, so the distributor stayed in cooldown while the
  // UI showed "OK" (mobile clears it via clearDistributorBreaker).
  it("clears the circuit breaker when re-enabling on desktop", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const start = text.indexOf("const handleReenableDistributor");
    const block = text.slice(start, text.indexOf("showToast(\"Distributor re-enabled\")", start));
    expect(block).toContain("clearDistributorBreaker(distributorId");
  });

  // QA round 178: mobile's DistributorListingCard shows "{country} · {region}";
  // desktop's Distributor cell showed only the country + flag.
  it("shows the distributor region on desktop listings", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toMatch(/dist\?\.region \? ` · \$\{dist\.region\}`/);
  });

  // QA round 177: desktop's Stats price-history chart fell back to the raw
  // price for an unconvertible point, plotting mixed currencies on a chart
  // labelled in the display currency.
  it("skips unconvertible points in the desktop Stats chart", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).not.toMatch(/convertPrice\([^)]*\) \?\? pt\.price/);
    expect(text).toMatch(/const converted = convertPrice\(pt\.price, pt\.currency, displayCurrency\)/);
  });

  // QA round 176: desktop's bestListing matcher fell back to the raw price when
  // a listing's currency couldn't be converted, mixing currencies and possibly
  // falsely matching the best price (mobile skips unconvertible listings).
  it("skips unconvertible listings when matching the desktop best listing", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = text.indexOf("const bestListing = useMemo");
    const block = text.slice(start, text.indexOf("}, [visibleListings, best, displayCurrency]);", start));
    expect(block).not.toMatch(/convertPrice\([^)]*\) \?\? l\.price/);
    expect(block).toMatch(/const converted = convertPrice\(l\.price, l\.currency, displayCurrency\)/);
  });

  // QA round 175: mobile's DistributorListingCard shows each distributor's
  // payment methods; desktop's Distributor Targets table omitted them.
  it("shows payment methods per listing on desktop", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toMatch(/dist\?\.paymentMethods && dist\.paymentMethods\.length > 0/);
    expect(text).toMatch(/💳 \{dist\.paymentMethods\.join\(" · "\)\}/);
  });

  // QA round 174: mobile's DistributorListingCard colors the freshness text
  // (green <1h, amber <6h, red older); desktop's table cell was always gray.
  it("colors the desktop listing freshness text", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("getLastRefreshedColor(listing.lastChecked)");
    expect(text).toContain("🕐 Updated {formatLastRefreshed(listing.lastChecked)}");
  });

  // QA round 173: mobile's StockWatchCard appends "· last checked" after the
  // status; desktop's stock-watch rows omitted it.
  it("shows the last-checked hint on desktop stock watches", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain("· last checked");
  });

  // QA round 172: mobile's RescheduleModal title is "Reschedule Reminder 📅";
  // desktop's was "Reschedule Reminder" without the emoji.
  it("titles the desktop reschedule modal like mobile", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain("Reschedule Reminder 📅");
  });

  // QA round 171: mobile's ReminderCard says "Was due {date}" for past
  // reminders and "Remind on {date}" otherwise; desktop always said "Due".
  it("labels past vs future desktop reminders like mobile", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain('isPast ? "Was due " : "Remind on "');
  });

  // QA round 170: mobile's TriggeredAlertCard button says "Watch Again";
  // desktop's said "Rearm".
  it("labels the desktop rearm button Watch Again", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain("Watch Again");
    expect(text).not.toMatch(/>\s*Rearm\s*</);
  });

  // QA round 169: mobile's TriggeredAlertCard shows the direction arrow plus
  // "Target: $X → $Y"; desktop's triggered row showed only "Triggered at $Y on
  // DATE", omitting the target and direction.
  it("shows the target and direction on desktop triggered alerts", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    const start = text.indexOf("Target: {formatPrice(alert.targetPrice");
    const block = text.slice(start, text.indexOf("Triggered on", start));
    expect(block).toContain("→ {formatPrice(alert.triggeredPrice");
    const dirStart = text.indexOf("isTriggered ? (");
    const dirBlock = text.slice(dirStart, text.indexOf("Target: {formatPrice(alert.targetPrice", dirStart));
    expect(dirBlock).toContain("Price rise alert");
  });

  // QA round 168: desktop's alert row appended the raw direction enum
  // ("drop"/"rise") as text; mobile renders a direction arrow icon.
  it("renders the alert direction as an icon on desktop", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).not.toMatch(/` · \$\{alert\.direction\}`/);
    expect(text).toContain('aria-label="Price rise alert"');
    expect(text).toContain('aria-label="Price drop alert"');
  });

  // QA round 167: the same inline-tag-creation gap existed in desktop's
  // SearchModal (the other search surface).
  it("creates tags inline in the desktop SearchModal tag picker", async () => {
    const text = await readFile("desktop/src/components/SearchModal.tsx", "utf8");
    expect(text).toContain("handleCreateTag");
    expect(text).toContain("New tag name");
    expect(text).toContain("Create tag");
  });

  // QA round 166: mobile's TagPickerSheet creates tags inline; desktop's search
  // "Assign tags" modal only toggled existing tags.
  it("creates tags inline in the desktop search tag picker", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toContain("handleCreateTag");
    expect(text).toContain("New tag name");
    expect(text).toContain("Create tag");
  });

  // QA round 165: mobile's bulk-import modal is titled "Import List 📋";
  // desktop's was titled "Bulk Import".
  it("titles the desktop bulk-import modal like mobile", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toContain("Import List 📋");
  });

  // QA round 164: mobile's manual-add sheet labels the parse button "Clean up
  // with AI" and the URL field "Paste distributor URL"; desktop said "Parse
  // with AI" with no URL label.
  it("labels the desktop manual-add buttons like mobile", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toContain("Clean up with AI");
    expect(text).toContain("Paste distributor URL");
    expect(text).not.toContain("Parse with AI");
  });

  // QA round 163: mobile's manual-add sheet is titled "Add Custom Product ✨"
  // with a "Paste anything … AI cleans it up." hint; desktop's modal was titled
  // "Manual Add" with no hint.
  it("titles the desktop manual-add modal like mobile", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toContain("Add Custom Product ✨");
    expect(text).toContain("AI cleans it up.");
  });

  // QA round 162: mobile shows the "Discover with AI" footer whenever there is
  // a query (even with partial catalog matches); desktop only showed it when
  // there were zero results.
  it("shows the Discover footer for any desktop search query", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toMatch(/\{query\.trim\(\) && \(\s*<div className="pt-4">/);
    expect(text).toMatch(/aria-label="Discover with AI"/);
  });

  // QA round 161: mobile's SearchEmptyState shows a "Try searching for RTX
  // 4090, Pi 5, CRS326, or AirPods Max" hint; desktop's empty state had none.
  it("shows the search suggestion hint on desktop", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toContain("Try searching for RTX 4090, Pi 5, CRS326, or AirPods Max");
  });

  // QA round 160: mobile's reminders empty state has a "Browse Products" CTA;
  // desktop's had none.
  it("has a Browse Products CTA in the desktop reminders empty state", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain('title="No reminders set"');
    expect(text).toContain("Browse products to set reminders");
  });

  // QA round 159: mobile's Alerts tab shows an info banner when active alerts
  // exist; desktop's AlertsTab had none.
  it("shows the active-alerts info banner on desktop", async () => {
    const text = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(text).toContain("You&apos;ll be notified when a product&apos;s price drops below your target.");
  });

  // QA round 158: mobile's digestPlaceholder returns null when the watchlist is
  // empty (the whole card is hidden); desktop showed "Digest off" even with no
  // products.
  it("hides the desktop digest card on an empty watchlist", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toMatch(/products\.length === 0 \? null : digestFrequency === "off"/);
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
    expect(text).toContain("Back-order everywhere");
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
