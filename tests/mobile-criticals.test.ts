import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

describe("mobile release blockers", () => {
  it("has exactly one shared-watchlist route", () => {
    const candidates = ["app/w/[token].tsx", "app/(tabs)/w/[token].tsx"].filter((file) =>
      existsSync(path.join(process.cwd(), file)),
    );
    expect(candidates).toHaveLength(1);
  });

  // The server's NOT_FOUND message is literally "Share not found", so rendering
  // `query.error.message` under a "Share not found" heading printed the same
  // sentence twice (verified on device). The screen must substitute an
  // actionable subtitle when the message just repeats the title.
  it("does not repeat the share-not-found heading as its own subtitle", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).not.toMatch(/\{query\.error\.message\}/);
    expect(src).toContain("This link may have expired, been revoked, or never existed.");
  });

  // QA round 18: "Add all to Watchlist" counted every non-throwing
  // addToWatchlist call as an add, but the storage layer silently no-ops on a
  // duplicate. Tapping it twice on an already-imported share reported "Added 2
  // products" while the watchlist stayed at 14 (verified on device). The screen
  // must branch on the boolean return and surface the duplicate count.
  it("counts only real inserts when adding a shared watchlist", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).toMatch(/if \(await addToWatchlist\(/);
    expect(src).toContain("duplicates");
    expect(src).toContain("already tracked");
  });

  // The server caps the public share payload at 500 products and returns
  // `truncated: true`; the client ignored it, so a >500-product share looked
  // like a complete (but short) watchlist. Surface the cap.
  it("surfaces the server's 500-product truncation flag", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).toContain("truncated");
    expect(src).toContain("first 500");
  });

  // QA round 21: the shared-watchlist header hardcoded "products", so a
  // single-product share rendered "1 products" (verified on web). Pluralize.
  it("pluralizes the shared-watchlist product count", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).toMatch(/product\{products\.length === 1 \? "" : "s"\}/);
  });

  // QA round 23: the shared-watchlist export handlers hand-rolled the web
  // download / native Share.share and swallowed every failure, so a failed
  // export did nothing visible (and native Share.share rejects on some
  // platforms). They must go through the shared exportCsvFile helper and
  // report the outcome.
  it("exports shared-watchlist CSVs through the shared helper with feedback", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).toContain("exportCsvFile");
    expect(src).not.toContain("Share.share");
    expect(src).toContain("Export unavailable");
  });
});

// QA round 29: tapping a distributor's sparkline on product detail must open
// Compare focused on that distributor. The mobile handler ignored the tapped
// listing (Compare has read a `distributor` param all along, and desktop passes
// it), so the tapped distributor was never selected.
describe("sparkline opens Compare focused on the tapped distributor", () => {
  it("threads the tapped listing's distributorId into the compare route", () => {
    const src = readFileSync(path.join(process.cwd(), "app/product/[id].tsx"), "utf8");
    expect(src).toMatch(/onOpenChart=\{\(listing\) => router\.push\(`\/compare\/\$\{id\}\?distributor=\$\{listing\.distributorId\}`\)\}/);
  });
});

// QA round 50: the basket-alert save optimistically set the threshold but
// never reverted it on failure, leaving a setting on screen that was never
// persisted.
describe("stats basket alert reverts on save failure", () => {
  it("restores the previous threshold", () => {
    const src = readFileSync(path.join(process.cwd(), "app/stats.tsx"), "utf8");
    const start = src.indexOf("const handleSaveBasketAlert");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("[settings, basketThreshold]", start));
    expect(block).toContain("const previous = basketThreshold");
    expect(block).toContain("setBasketThreshold(previous)");
  });
});

// QA round 53: `hooks/use-product-detail.ts` was orphaned when the product
// detail screen switched to `useLiveProduct`; only its own test imported it.
describe("orphaned product-detail hook stays deleted", () => {
  it("does not keep hooks/use-product-detail.ts", () => {
    expect(() =>
      readFileSync(path.join(process.cwd(), "hooks/use-product-detail.ts"), "utf8"),
    ).toThrow();
  });
});

// QA round 82: the Settings data section's export/import handlers had no
// catch, so a storage read/write failure rejected unhandled.
describe("settings data section guards its export/import", () => {
  const src = readFileSync(
    path.join(process.cwd(), "components/settings/data-section.tsx"),
    "utf8",
  );

  it("guards the backup export", () => {
    const start = src.indexOf("const handleExport = async () => {");
    const block = src.slice(start, src.indexOf("};", start));
    expect(block).toContain("catch");
  });

  it("guards the CSV export", () => {
    const start = src.indexOf("const handleExportCsv = async () => {");
    const block = src.slice(start, src.indexOf("};", start));
    expect(block).toContain("catch");
  });

  it("guards the import save", () => {
    const start = src.indexOf("onPress: async () => {");
    const block = src.slice(start, src.indexOf("},", start));
    expect(block).toContain("catch");
  });
});

// QA round 80: the Distributor Analysis export shared the CSV as a text
// message (shareText) instead of a .csv file (exportCsvFile), unlike every
// other CSV export.
describe("distributor analysis exports a CSV file", () => {
  it("uses the shared exportCsvFile helper", () => {
    const src = readFileSync(path.join(process.cwd(), "app/distributor-analysis.tsx"), "utf8");
    expect(src).toContain("exportCsvFile");
    expect(src).not.toContain("shareText");
  });
});

// QA round 79: the watchlist share text hardcoded "products", so a
// single-product share read "1 products".
describe("watchlist share text pluralizes", () => {
  it("pluralizes the product counts", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/watchlist-share.ts"), "utf8");
    expect(src).toMatch(/watchlist\.length === 1 \? "" : "s"/);
    expect(src).toMatch(/basket\.productCount === 1 \? "" : "s"/);
  });
});

// QA round 76: the CSV import created a new alert for every row with a target
// price, even for already-tracked products, so re-importing accumulated
// duplicate alerts (addAlert has no dedup).
describe("CSV import doesn't duplicate alerts", () => {
  it("skips alert creation when an active alert already exists", () => {
    const src = readFileSync(path.join(process.cwd(), "app/(tabs)/watchlist.tsx"), "utf8");
    const start = src.indexOf("const handleImportCsv");
    const block = src.slice(start, src.indexOf("}, [reload, loadData]);", start));
    expect(block).toContain("existingAlertProductIds");
    expect(block).toMatch(/row\.targetPrice !== null && !existingAlertProductIds\.has\(product\.id\)/);
  });
});

// QA round 75: launch fired `void checkPriceDropsNow()` / `void loadFxRates()`
// / `void maybeRefreshFxRates()` with no catch, so a storage read failure was
// an unhandled rejection.
describe("launch side effects are guarded", () => {
  const src = readFileSync(path.join(process.cwd(), "app/_layout.tsx"), "utf8");

  it("guards the launch price check", () => {
    expect(src).toContain("void checkPriceDropsNow().catch(");
  });

  it("guards the FX loads", () => {
    expect(src).toContain("void loadFxRates().catch(");
    expect(src).toContain("void maybeRefreshFxRates().catch(");
  });
});

// QA round 74: the forgot-password paths fetched `${getApiBaseUrl()}/...`
// without checking the base URL was configured.
describe("forgot-password checks the API base URL", () => {
  it("useAuth.forgotPassword guards an empty base URL", () => {
    const src = readFileSync(path.join(process.cwd(), "hooks/use-auth.ts"), "utf8");
    const start = src.indexOf("const forgotPassword");
    const block = src.slice(start, src.indexOf("}, []);", start));
    expect(block).toContain("if (!baseUrl) throw new Error");
  });

  it("login-modal guards an empty base URL", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/settings/login-modal.tsx"),
      "utf8",
    );
    const start = src.indexOf("const res = await fetch(`${baseUrl}/api/auth/forgot`");
    expect(start).toBeGreaterThan(-1);
    expect(src.slice(start - 120, start)).toContain("if (!baseUrl) throw new Error");
  });
});

// QA round 73: verify-email fetched `${getApiBaseUrl()}/api/auth/verify`
// without checking the base URL was configured, so an unconfigured build hit
// the relative path and showed a confusing failure (oauth/callback checks it).
describe("verify-email checks the API base URL", () => {
  it("bails with a clear error when unconfigured", () => {
    const src = readFileSync(path.join(process.cwd(), "app/verify-email.tsx"), "utf8");
    expect(src).toContain("const baseUrl = getApiBaseUrl();");
    expect(src).toContain("if (!baseUrl)");
    expect(src).toContain("isn't connected to a server");
  });
});

// QA round 72: the notification center's per-item open awaited
// markNotificationRead with no catch (desktop wraps it).
describe("notification center open handles failure", () => {
  it("wraps markNotificationRead in try/catch", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/notification-center.tsx"),
      "utf8",
    );
    const start = src.indexOf("const handleOpen");
    const block = src.slice(start, src.indexOf("[router, decrementUnread]", start));
    expect(block).toContain("try {");
    expect(block).toContain("catch");
    expect(block).toContain("markNotificationRead(item.id)");
  });
});

// QA round 71: the notification center's "Mark all read" had no catch, so a
// storage failure was an unhandled rejection (desktop wraps it).
describe("notification center mark-all handles failure", () => {
  it("wraps markAllNotificationsRead in try/catch", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/notification-center.tsx"),
      "utf8",
    );
    const start = src.indexOf("const handleMarkAll");
    const block = src.slice(start, src.indexOf("}, [applyUnread]);", start));
    expect(block).toContain("try {");
    expect(block).toContain("catch");
    expect(block).toContain("showAlert");
  });
});

// QA round 70: the notification center decremented the unread badge from a
// stale `unreadCount` closure, so two quick taps under-counted by one.
describe("notification center decrements unread functionally", () => {
  it("uses a functional decrement instead of the stale closure", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/notification-center.tsx"),
      "utf8",
    );
    expect(src).toContain("const decrementUnread = useCallback");
    expect(src).toContain("setUnreadCount((prev) => {");
    expect(src).toContain("decrementUnread()");
    expect(src).not.toContain("applyUnread(Math.max(0, unreadCount - 1))");
  });
});

// QA round 69: removing a stock watch from the Alerts screen didn't cancel its
// scheduled confirmation notification, so it still fired after removal.
describe("removing a stock watch cancels its notification", () => {
  it("cancels the watch's notificationId before removing", () => {
    const src = readFileSync(path.join(process.cwd(), "hooks/use-alerts-data.ts"), "utf8");
    const start = src.indexOf("const handleRemoveStockWatch");
    const block = src.slice(start, src.indexOf("}, [loadData]);", start));
    expect(block).toContain("cancelNotification(watch.notificationId)");
    expect(block).toContain("removeStockWatch(watch.id)");
  });
});

// QA round 68: EditProductSheet.handleSave had no catch, so a storage failure
// was an unhandled rejection and the sheet closed as if the edit succeeded.
describe("edit product sheet handles save failure", () => {
  it("wraps the save in try/catch with feedback", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/product/edit-product-sheet.tsx"),
      "utf8",
    );
    const start = src.indexOf("const handleSave");
    const block = src.slice(start, src.indexOf("};", start));
    expect(block).toContain("catch");
    expect(block).toContain("showAlert");
  });
});

// QA round 65: AI discovery claimed "Added X to watchlist" but only saved to
// the discovered catalog, so the product detail screen (which reads the
// watchlist) showed "Product not found".
describe("AI discovery adds the product to the watchlist", () => {
  it("calls addToWatchlist before navigating", () => {
    const src = readFileSync(path.join(process.cwd(), "app/search.tsx"), "utf8");
    const start = src.indexOf("const handleDiscover");
    const block = src.slice(start, src.indexOf("}, [query, discovering", start));
    expect(block).toContain("await addToWatchlist({");
    expect(block).toContain("router.push(`/product/${result.product.id}`)");
  });
});

// QA round 64: the reminder reschedule had no double-submit guard, so a rapid
// double-tap scheduled two notifications and orphaned the first.
describe("reminder reschedule guards against double-submit", () => {
  it("sets and checks a rescheduling guard", () => {
    const src = readFileSync(path.join(process.cwd(), "hooks/use-alerts-data.ts"), "utf8");
    expect(src).toContain("const [rescheduling, setRescheduling] = useState(false)");
    const start = src.indexOf("const handleReschedule");
    const block = src.slice(start, src.indexOf("}, [rescheduleTarget, rescheduleDate", start));
    expect(block).toContain("if (!rescheduleTarget || rescheduling) return;");
    expect(block).toContain("setRescheduling(true)");
    expect(block).toContain("setRescheduling(false)");
  });
});

// QA round 62: the restock-watch toggle had no double-submit guard, so a rapid
// double-tap scheduled two confirmation notifications and orphaned the first
// (replaced) id so it could never be cancelled.
describe("restock-watch toggle guards against double-submit", () => {
  it("sets and checks a togglingWatch guard", () => {
    const src = readFileSync(path.join(process.cwd(), "app/product/[id].tsx"), "utf8");
    expect(src).toContain("const [togglingWatch, setTogglingWatch] = useState(false)");
    const start = src.indexOf("const handleToggleStockWatch");
    const block = src.slice(start, src.indexOf("}, [id, product, stockWatches", start));
    expect(block).toContain("if (!id || togglingWatch) return;");
    expect(block).toContain("setTogglingWatch(true)");
    expect(block).toContain("setTogglingWatch(false)");
  });
});

// QA round 60: the product-detail alert flows (best-distributor card and the
// scoped PriceAlertModal) had no double-submit guard, so a rapid double-tap or
// Enter+button created two alerts.
describe("product detail alert creation guards against double-submit", () => {
  const src = readFileSync(path.join(process.cwd(), "app/product/[id].tsx"), "utf8");

  it("sets and checks a creatingAlert guard", () => {
    expect(src).toContain("const [creatingAlert, setCreatingAlert] = useState(false)");
    for (const handler of ["const handleSetBestAlert", "const handleSetAlert"]) {
      const start = src.indexOf(handler);
      expect(start).toBeGreaterThan(-1);
      const block = src.slice(start, src.indexOf("}, [", start));
      expect(block).toContain("creatingAlert");
      expect(block).toContain("setCreatingAlert(true)");
      expect(block).toContain("setCreatingAlert(false)");
    }
  });
});

// QA round 59: the Compare cross-distributor alert had no double-submit guard,
// so a rapid double-tap created two identical alerts.
describe("compare cross-alert guards against double-submit", () => {
  it("mobile sets and checks a creatingAlert guard", () => {
    const src = readFileSync(path.join(process.cwd(), "app/compare/[id].tsx"), "utf8");
    expect(src).toContain("const [creatingAlert, setCreatingAlert] = useState(false)");
    const start = src.indexOf("const handleCrossAlert");
    const block = src.slice(start, src.indexOf("}, [listings, id, productName", start));
    expect(block).toContain("if (creatingAlert) return;");
    expect(block).toContain("setCreatingAlert(true)");
    expect(block).toContain("setCreatingAlert(false)");
  });
});

// QA round 56: the distributor selector computed `allDistributorIds` and then
// immediately `void`ed it — dead work on every render.
describe("distributor selector has no dead computation", () => {
  it("does not compute an unused allDistributorIds", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/compare/distributor-selector.tsx"),
      "utf8",
    );
    expect(src).not.toContain("allDistributorIds");
    expect(src).not.toContain("void allDistributorIds");
  });
});

// QA round 54: three exports were referenced nowhere (not even in their own
// module or tests): parseWatchlistDetailedCsv, getQueuedEditCount, and
// computeWatchlistStats (plus its WatchlistStats type).
describe("dead lib exports stay removed", () => {
  const cases: Array<[string, string]> = [
    ["lib/csv.ts", "parseWatchlistDetailedCsv"],
    ["lib/sync.ts", "getQueuedEditCount"],
    ["lib/watchlist-stats.ts", "computeWatchlistStats"],
    ["lib/watchlist-stats.ts", "WatchlistStats"],
  ];
  for (const [file, symbol] of cases) {
    it(`${file} no longer exports ${symbol}`, () => {
      const src = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src).not.toMatch(new RegExp(`export (async )?(function|interface) ${symbol}\\b`));
    });
  }
});

// QA round 49: bare storage.then chains rejected unhandled on a storage
// failure. Each must have a .catch.
describe("mobile storage.then chains are guarded", () => {
  for (const [file, needle] of [
    ["lib/web-notifications.ts", "void getSettings()"],
    ["components/home/trending-section.tsx", "getWatchlist()"],
  ] as const) {
    it(`${file} guards its storage read`, () => {
      const src = readFileSync(path.join(process.cwd(), file), "utf8");
      const start = src.indexOf(needle);
      expect(start).toBeGreaterThan(-1);
      expect(src.slice(start, start + 500)).toContain(".catch(");
    });
  }
});

// QA round 46: alerts created via the Best-Distributor card or the inline
// AlertSection were written to storage but never added to the screen's `alerts`
// state, so the Distributor Targets table (which reads that state) stayed
// stale until the screen reloaded.
describe("product detail keeps its alerts state in sync", () => {
  const src = readFileSync(path.join(process.cwd(), "app/product/[id].tsx"), "utf8");

  it("adds the best-distributor alert to state", () => {
    const start = src.indexOf("const handleSetBestAlert");
    const block = src.slice(start, src.indexOf("}, [id, product, showToast]);", start));
    expect(block).toContain("setAlerts((prev) => [...prev, alert])");
  });

  it("wires AlertSection's onAdded to state", () => {
    expect(src).toMatch(/<AlertSection[^>]*onAdded=\{\(alert\) => setAlerts/);
  });
});

// QA round 16: the search screen rendered its filter chrome (tag chips,
// category/brand pill rows, sort bar) as fixed flex siblings above the results
// FlatList. On a 1080x2400 device those rows consumed ~2076px, squeezing the
// list into a ~324px strip at the bottom — the empty state and every result
// past the first card were clipped below the fold (verified on device: "25
// RESULTS" showed only a sliver of the first card). The chrome must live in the
// list's ListHeaderComponent so it scrolls away with the content, exactly like
// the watchlist screen's QA-round-8 fix.
describe("search results list owns the filter chrome", () => {
  const src = readFileSync(path.join(process.cwd(), "app/search.tsx"), "utf8");

  it("gives the results FlatList flex:1", () => {
    const listStart = src.indexOf("<FlatList");
    expect(listStart).toBeGreaterThan(-1);
    const openingTag = src.slice(listStart, listStart + 400);
    expect(openingTag).toMatch(/style=\{\{\s*flex:\s*1\s*\}\}/);
  });

  it("renders the filter chrome inside ListHeaderComponent", () => {
    const listStart = src.indexOf("<FlatList");
    const headerStart = src.indexOf("ListHeaderComponent=");
    const headerEnd = src.indexOf("ListEmptyComponent=");
    expect(listStart).toBeGreaterThan(-1);
    expect(headerStart).toBeGreaterThan(listStart);
    expect(headerEnd).toBeGreaterThan(headerStart);
    const header = src.slice(headerStart, headerEnd);
    expect(header).toContain("TagFilterRow");
    expect(header).toContain("PillFilterRow");
    expect(header).toContain("RecentSearches");
  });

  it("does not render filter chrome as fixed siblings before the FlatList", () => {
    const listStart = src.indexOf("<FlatList");
    const before = src.slice(0, listStart);
    expect(before).not.toContain("<TagFilterRow");
    expect(before).not.toContain("<PillFilterRow");
    expect(before).not.toContain("<RecentSearches");
  });
});

// QA round 17: the 2026-08-28 "product detail orchestration" refactor was meant
// to be a pure extraction (its spec says "[id].tsx (unchanged)" and "no logic
// changes"), but it dropped three render sites while still barrel-exporting the
// components. Private notes (Phase 90) and the distributor targets table
// (Phase 93) silently vanished from mobile while desktop kept both. These
// guards pin the render sites so a future refactor can't drop them again.
describe("product detail keeps its notes and distributor targets", () => {
  const src = readFileSync(path.join(process.cwd(), "app/product/[id].tsx"), "utf8");

  it("renders NotesCard", () => {
    expect(src).toMatch(/<NotesCard\b/);
  });

  it("renders TargetTableCard wired to the scoped-alert flow", () => {
    expect(src).toMatch(/<TargetTableCard\b/);
    expect(src).toContain("onSetTarget={handleSetTarget}");
    expect(src).toMatch(/<PriceAlertModal\b/);
  });

  it("keeps the notes and targets out of the share-image capture", () => {
    const shareStart = src.indexOf("ref={shareRef}");
    const shareEnd = src.indexOf("</View>", src.indexOf("<DistributorListingSection", shareStart));
    expect(shareStart).toBeGreaterThan(-1);
    expect(shareEnd).toBeGreaterThan(shareStart);
    const captured = src.slice(shareStart, shareEnd);
    expect(captured).not.toContain("<NotesCard");
    expect(captured).not.toContain("<TargetTableCard");
  });
});

// The per-distributor price-history modal owned CSV export until the same
// refactor dropped it. Compare is now the chart surface, so the export moved
// there; the modal is deleted rather than left as unreachable dead code.
describe("price-history CSV export lives on the Compare screen", () => {
  const compare = readFileSync(path.join(process.cwd(), "app/compare/[id].tsx"), "utf8");

  it("exports price history via the shared csv helper", () => {
    expect(compare).toContain("priceHistoryToCsv");
    expect(compare).toContain("exportCsvFile");
    expect(compare).toMatch(/accessibilityLabel="Export price history as CSV"/);
  });

  it("no longer ships the unreachable PriceChartModal", () => {
    expect(() =>
      readFileSync(path.join(process.cwd(), "components/product/price-chart-modal.tsx"), "utf8"),
    ).toThrow();
    const barrel = readFileSync(path.join(process.cwd(), "app/product/_components.tsx"), "utf8");
    expect(barrel).not.toContain("PriceChartModal");
  });

  // The modal was the mobile PriceHistoryChart's only consumer; deleting the
  // modal orphaned the chart too. Compare's MultiLineChart is the mobile chart
  // surface now, so the single-series chart is unreachable dead source (Metro
  // tree-shakes it from the bundle, but it should not linger in the repo).
  it("no longer keeps the orphaned single-series PriceHistoryChart", () => {
    expect(() =>
      readFileSync(path.join(process.cwd(), "components/price-history-chart.tsx"), "utf8"),
    ).toThrow();
  });
});

// QA round 24: three components were left orphaned by earlier refactors and
// shipped as unreachable dead source — `distributor-row.tsx` (never rendered),
// `themed-view.tsx` (its last consumer was the dev theme-lab, removed in
// ece89bd), and `product-share-card.tsx` (the branded share card, replaced by
// the visible-screen capture in 07c74a1). None are imported anywhere.
describe("orphaned components stay deleted", () => {
  for (const file of [
    "components/product/distributor-row.tsx",
    "components/themed-view.tsx",
    "components/share/product-share-card.tsx",
  ]) {
    it(`does not keep ${file}`, () => {
      expect(() => readFileSync(path.join(process.cwd(), file), "utf8")).toThrow();
    });
  }
});

// QA round 22: a sweep of the remaining count labels that hardcoded the plural
// (Stock Health "N listings", health drill-down "N samples", sparkline a11y
// "N points", bulk-import a11y "N products"). Each can render with a count of 1.
describe("count labels pluralize", () => {
  const cases: Array<[string, RegExp]> = [
    ["components/stats/stock-health-card.tsx", /listing\{health\.totalListings === 1 \? "" : "s"\}/],
    ["app/health/[id].tsx", /sample\{summary\.count === 1 \? "" : "s"\}/],
    ["app/health/[id].tsx", /sample\{g\.samples\.length === 1 \? "" : "s"\}/],
    ["components/price-sparkline.tsx", /point\$\{data\.length === 1 \? "" : "s"\}/],
    ["components/search/bulk-import-modal.tsx", /product\$\{newProducts\.length === 1 \? "" : "s"\}/],
  ];
  for (const [file, pattern] of cases) {
    it(`${file} pluralizes`, () => {
      expect(readFileSync(path.join(process.cwd(), file), "utf8")).toMatch(pattern);
    });
  }
});
