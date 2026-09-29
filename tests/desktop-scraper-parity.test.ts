import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Guards the class of bug where the desktop (Rust) scrapers drift from the
// mobile (TS) ones: wrong search URL or wrong price selector means desktop
// silently reports "no price found" for a distributor that mobile handles.

async function mobileParsers(): Promise<Map<string, { url: string; selector: string }>> {
  const dir = "lib/scrapers";
  const out = new Map<string, { url: string; selector: string }>();
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".ts")) continue;
    const name = file.slice(0, -3);
    const src = await readFile(path.join(dir, file), "utf8");
    const url =
      src.match(/buildSearchUrl:\s*\(model\)\s*=>\s*`([^`]+)`/)?.[1] ??
      src.match(/const buildMikrotikSearchUrl[\s\S]*?`([^`]+)`/)?.[1];
    const selector =
      src.match(/findPriceElement\(\s*\$\s*,\s*"([^"]+)"/)?.[1] ??
      src.match(/\$\(\s*"([^"]*(?:price|Price)[^"]*)"\s*\)/)?.[1];
    if (url) out.set(name, { url, selector: selector ?? "" });
  }
  return out;
}

async function rustParsers(): Promise<Map<string, { url: string; selector: string }>> {
  const dir = "desktop/src-tauri/src/scrapers";
  const out = new Map<string, { url: string; selector: string }>();
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".rs") || file === "mod.rs" || file === "browser.rs") continue;
    const name = file.slice(0, -3);
    const src = await readFile(path.join(dir, file), "utf8");
    // Tolerant of rustfmt wrapping the call across lines.
    const url = src.match(/let url = format!\(\s*"([^"]+)"/)?.[1];
    const selector = src.match(
      /parse_price_page\([\s\S]{0,200}?"[A-Z]{3}",\s*"([^"]+)"/,
    )?.[1];
    if (url) out.set(name, { url: url.replace("{}", ""), selector: selector ?? "" });
  }
  return out;
}

describe("desktop/mobile scraper parity", () => {
  it("every Rust parser uses the same search host+path as mobile", async () => {
    const mobile = await mobileParsers();
    const rust = await rustParsers();
    expect(rust.size).toBeGreaterThan(20);
    for (const [name, r] of rust) {
      const m = mobile.get(name);
      if (!m) continue;
      const normalize = (u: string) =>
        u
          .replace("${encodeURIComponent(model)}", "")
          .replace(/^https?:\/\/(www\.)?/, "")
          .replace(/\/$/, "");
      expect(normalize(r.url), `${name} search URL drifted`).toBe(
        normalize(m.url),
      );
    }
  });

  it("every Rust parser uses the same price selector as mobile", async () => {
    const mobile = await mobileParsers();
    const rust = await rustParsers();
    for (const [name, r] of rust) {
      const m = mobile.get(name);
      if (!m || !m.selector) continue;
      // jQuery's `:contains()` is not understood by the `scraper` crate, so the
      // Rust engine translates it itself (scrapers/mod.rs `select_selector_list`)
      // and both sides must pass the same selector through.
      expect(r.selector, `${name} price selector drifted`).toBe(m.selector);
    }
  });

  it("every Rust parser declares the same currency as mobile", async () => {
    // A currency mismatch shows the wrong price on desktop (e.g. a GBP figure
    // labelled USD). The URL/selector parity tests did not cover this.
    const dir = "desktop/src-tauri/src/scrapers";
    let checked = 0;
    for (const file of await readdir(dir)) {
      if (!file.endsWith(".rs") || file === "mod.rs" || file === "browser.rs") continue;
      const name = file.slice(0, -3);
      const rust = await readFile(path.join(dir, file), "utf8");
      const rustCurrency = rust.match(
        /parse_price_page\([\s\S]{0,200}?"([A-Z]{3})"/,
      )?.[1];
      if (!rustCurrency) continue;
      const ts = await readFile(`lib/scrapers/${name}.ts`, "utf8");
      const tsCurrency = ts.match(/currency:\s*"([A-Z]{3})"/)?.[1];
      if (!tsCurrency) continue;
      checked++;
      expect(rustCurrency, `${name} currency drifted`).toBe(tsCurrency);
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("keeps the Rust model matcher aligned with the shared parser rules", async () => {
    // The shared `matchesModel` rules the Rust port must mirror: a preceding
    // LETTER is a brand concatenation (allowed), a preceding DIGIT is not, and a
    // short commerce suffix is tolerated only after a trailing separator. The
    // Rust engine only understood the plain whole-token case, so it silently
    // reported "no price found" for cards the mobile parser handles.
    const rust = await readFile(
      "desktop/src-tauri/src/scrapers/mod.rs",
      "utf8",
    );
    expect(rust).toContain("fn text_mentions_model");
    expect(rust, "preceding-letter rule missing").toContain("is_ascii_alphabetic");
    expect(rust, "trailing-separator rule missing").toContain("[^a-z0-9]+?");
    expect(rust, "commerce-suffix rule missing").toContain("is_commerce_suffix");

    const suffixesOf = (src: string, block: RegExp): string[] => {
      const body = src.match(block)?.[1] ?? "";
      return [...body.matchAll(/"([a-z]{2})"/g)].map((m) => m[1]!).sort();
    };
    const ts = await readFile("lib/scrapers/utils.ts", "utf8");
    const tsSuffixes = suffixesOf(ts, /const COMMERCE_SUFFIXES = new Set\(\[([\s\S]*?)\]\)/);
    const rustSuffixes = suffixesOf(rust, /const COMMERCE_SUFFIXES: \[&str; \d+\] = \[([\s\S]*?)\]/);
    expect(tsSuffixes.length).toBeGreaterThan(5);
    expect(rustSuffixes).toEqual(tsSuffixes);

    // Both sides must keep the whitespace-less card corpus that caught this.
    const shared = await readFile("tests/scrapers/utils.test.ts", "utf8");
    expect(shared).toContain("MikroTikCRS326-24G-2S+IN");
    expect(rust).toContain("MikroTikCRS326-24G-2S+IN");
  });

  it("every Rust browser parser waits for the same selector as mobile", async () => {
    // A wait for a selector the page never renders used to fail the whole
    // browser fetch (see the soft-fail test below) and send the desktop down a
    // plain-HTML path that cannot contain JS-rendered results. The wait target
    // itself must match the shared per-distributor value.
    const dir = "lib/scrapers";
    let checked = 0;
    for (const file of await readdir(dir)) {
      if (!file.endsWith(".ts")) continue;
      const name = file.slice(0, -3);
      const ts = await readFile(path.join(dir, file), "utf8");
      if (!/useBrowser:\s*true/.test(ts)) continue;
      const tsWait = ts.match(/waitForSelector:\s*"([^"]+)"/)?.[1] ?? null;
      const rust = await readFile(
        `desktop/src-tauri/src/scrapers/${name}.rs`,
        "utf8",
      );
      const rustWait =
        rust.match(/fetch_with_browser\(\s*[^,]+,\s*Some\("([^"]+)"\)/)?.[1] ?? null;
      checked++;
      expect(rustWait, `${name} browser wait selector drifted`).toBe(tsWait);
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("soft-fails a missing browser wait selector like the shared path", async () => {
    const browserRs = await readFile(
      "desktop/src-tauri/src/scrapers/browser.rs",
      "utf8",
    );
    expect(browserRs, "a missing selector must not fail the fetch").toMatch(
      /let _ = locator\.wait_for\(/,
    );
    expect(browserRs, "30s hard-fail wait is gone").not.toContain(
      "locator.wait_for(None)",
    );
  });

  it("keeps the Rust stock-status markers identical to the shared parser", async () => {
    // The shared parser and the Rust fallback must classify the same text the
    // same way. `preorder` was missing from the shared list, so a store's
    // "Preorder available" was in_stock server-side/mobile while the desktop
    // said back_order.
    const ts = await readFile("lib/scrapers/utils.ts", "utf8");
    const tsStart = ts.indexOf("export function inferStockStatus");
    const tsBody = ts.slice(tsStart, ts.indexOf("\n}", tsStart));
    const tsMarkers = [...tsBody.matchAll(/includes\("([^"]+)"\)/g)]
      .map((m) => m[1]!)
      .sort();

    const rust = await readFile("desktop/src-tauri/src/scrapers/mod.rs", "utf8");
    const rustStart = rust.indexOf("pub fn infer_stock_status");
    const rustBody = rust.slice(rustStart, rust.indexOf("\n}", rustStart));
    const rustMarkers = [...rustBody.matchAll(/contains\("([^"]+)"\)/g)]
      .map((m) => m[1]!)
      .sort();

    expect(tsMarkers.length).toBeGreaterThan(10);
    expect(rustMarkers).toEqual(tsMarkers);
  });

  it("keeps the shared price/stock corpora on both platforms", async () => {
    const shared = await readFile("tests/scraping-integration.test.ts", "utf8");
    const rust = await readFile("desktop/src-tauri/src/scrapers/mod.rs", "utf8");
    for (const sample of [
      "1.234.567",
      "12 345,67 Kč",
      "Preorder available",
      "1.2.3",
    ]) {
      expect(shared, `shared corpus lost ${sample}`).toContain(sample);
      expect(rust, `Rust corpus lost ${sample}`).toContain(sample);
    }
  });

  it("keeps the Rust price-context walk aligned with the shared helpers", async () => {
    // The Rust must mirror productRowContext / matchDepth / modelMismatch: the
    // walk starts at the element itself, `closest` includes the element, the
    // product link href is part of the context, and selector alternatives are
    // priority-ordered like findPriceElement.
    const rust = await readFile("desktop/src-tauri/src/scrapers/mod.rs", "utf8");
    expect(rust).toContain("fn product_row_context");
    expect(rust).toContain("fn match_depth");
    expect(rust).toContain("fn model_mismatch");
    expect(rust, "href must be part of the context").toContain('"a[href]"');
    expect(rust, "walk must start at the element").toContain("std::iter::once(*el)");
    expect(rust).toContain("for alternative in price_selector.split(',')");
    expect(rust, "ancestors() skips self").toContain("if sel.matches(el)");
  });

  it("keeps the Rust blocked-page markers identical to the shared parser", async () => {
    // The desktop must classify an anti-bot interstitial the same way; a
    // missing marker turns a block into "content", so the parser reports a
    // miss and the distributor is retried against the block.
    const listOf = (src: string, header: string): string[] => {
      const start = src.indexOf(header);
      expect(start, `${header} missing`).toBeGreaterThan(-1);
      const body = src.slice(start, src.indexOf("];", start));
      return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    };
    const ts = await readFile("lib/scrapers/resilient.ts", "utf8");
    const tsMarkers = listOf(ts, "export const BLOCKED_MARKERS");
    const rust = await readFile("desktop/src-tauri/src/scrapers/mod.rs", "utf8");
    const rustMarkers = listOf(rust, "pub const BLOCKED_MARKERS");
    expect(tsMarkers.length).toBeGreaterThan(5);
    expect(rustMarkers).toEqual(tsMarkers);
  });

  it("keeps the Rust circuit breaker constants in step with the shared defaults", async () => {
    // The desktop skips a distributor that is blocking or repeatedly failing,
    // using the same thresholds as the shared resilient fetch. Drift would mean
    // the desktop hammers (or over-benches) a distributor the mobile path does
    // not.
    const ts = await readFile("lib/scrapers/resilient.ts", "utf8");
    const rust = await readFile(
      "desktop/src-tauri/src/scrapers/breaker.rs",
      "utf8",
    );
    const pairs: Array<[string, string]> = [
      [
        "blockedCooldownMs = opts.blockedCooldownMs ?? 30 * 60 * 1000",
        "BLOCKED_COOLDOWN_MS: u64 = 30 * 60 * 1000",
      ],
      [
        "failureCooldownMs = opts.failureCooldownMs ?? 15 * 60 * 1000",
        "FAILURE_COOLDOWN_MS: u64 = 15 * 60 * 1000",
      ],
      [
        "failureThreshold = opts.failureThreshold ?? 3",
        "FAILURE_THRESHOLD: u32 = 3",
      ],
      [
        "maxCooldownMs = opts.maxCooldownMs ?? 2 * 60 * 60 * 1000",
        "MAX_COOLDOWN_MS: u64 = 2 * 60 * 60 * 1000",
      ],
    ];
    for (const [tsSnippet, rustSnippet] of pairs) {
      expect(ts, `shared default changed: ${tsSnippet}`).toContain(tsSnippet);
      expect(rust, `Rust breaker drifted: ${rustSnippet}`).toContain(rustSnippet);
    }
    // Both growth curves stay 1.5x per consecutive block, capped.
    expect(ts).toContain("Math.pow(1.5, consecutiveFailures - 1)");
    expect(rust).toContain("1.5_f64.powi");
  });

  it("keeps the Rust browser region signals aligned with the shared distributors", async () => {
    // A store that localizes currency for US visitors renders a price the
    // parser's static currency label does not match, so the browser context
    // must carry the distributor's region signals on both platforms.
    const ts = await readFile("shared/src/distributors.ts", "utf8");
    const entries = [
      ...ts.matchAll(
        /\{\s*id: "([^"]+)",[\s\S]*?region: "([^"]+)",[\s\S]*?website: "([^"]+)"/g,
      ),
    ];
    const hostOf = (u: string) =>
      u.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!;
    const byHost = new Map(
      entries.map(([, , region, website]) => [hostOf(website!), region!]),
    );
    expect(byHost.size).toBeGreaterThan(20);

    const rust = await readFile(
      "desktop/src-tauri/src/scrapers/browser.rs",
      "utf8",
    );
    const tableStart = rust.indexOf("const HOST_REGIONS");
    const table = rust.slice(tableStart, rust.indexOf("];", tableStart));
    const rows = [...table.matchAll(/\("([^"]+)", ([A-Z_]+)\)/g)];
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      const hostName = row[1]!;
      const regionConst = row[2]!;
      const expected = byHost.get(hostName);
      expect(expected, `${hostName} missing from shared distributors`).toBeDefined();
      expect(regionConst, `${hostName} region drifted`).toBe(
        expected!.toUpperCase().replace(/[ -]/g, "_"),
      );
    }

    // The five region presets must match the shared REGION_SIGNALS.
    const sharedBrowser = await readFile("lib/scrapers/browser.ts", "utf8");
    const presets: Array<[string, string]> = [
      ["en-GB", "Europe/Berlin"],
      ["en-AU", "Australia/Sydney"],
      ["en-AE", "Asia/Dubai"],
      ["en-ZA", "Africa/Johannesburg"],
      ["en-US", "America/New_York"],
    ];
    for (const [locale, timezone] of presets) {
      expect(sharedBrowser, `shared preset ${locale}`).toContain(
        `locale: "${locale}", timezoneId: "${timezone}"`,
      );
      expect(rust, `Rust locale ${locale}`).toContain(`locale: "${locale}"`);
      expect(rust, `Rust timezone ${timezone}`).toContain(
        `timezone_id: "${timezone}"`,
      );
    }
  });

  it("keeps the desktop stealth context and headers in step with the shared fetch", async () => {
    const browserRs = await readFile(
      "desktop/src-tauri/src/scrapers/browser.rs",
      "utf8",
    );
    const modRs = await readFile("desktop/src-tauri/src/scrapers/mod.rs", "utf8");
    const sharedBrowser = await readFile("lib/scrapers/browser.ts", "utf8");
    const sharedUtils = await readFile("lib/scrapers/utils.ts", "utf8");

    // Plain path: the shared fetch sends Accept-Language; without it a store may
    // render a different language (and currency) than the parser expects.
    expect(sharedUtils).toContain('"Accept-Language": "en-US,en;q=0.9"');
    expect(modRs).toContain('.header("Accept-Language", "en-US,en;q=0.9")');

    // Every anti-detection override the shared init script installs must be in
    // the desktop's script too — a default context reports webdriver = true.
    const markers = [
      'navigator, "webdriver"',
      'navigator, "plugins"',
      'navigator, "languages"',
      "chrome = {",
      "permissions.query",
      '"Intel Inc."',
      '"Intel Iris OpenGL Engine"',
    ];
    for (const marker of markers) {
      expect(sharedBrowser, `shared init script lost ${marker}`).toContain(marker);
      expect(browserRs, `Rust init script lost ${marker}`).toContain(marker);
    }
    expect(browserRs).toContain("add_init_script(STEALTH_INIT_SCRIPT)");

    // The browser attempt retries like the shared loop, but never a block.
    expect(browserRs).toContain("const MAX_RETRIES: u32 = 2;");
    expect(browserRs).toContain("super::is_blocked_error(&error)");
  });

  it("keeps the desktop cookie jar in step with the shared browser path", async () => {
    // Both browser paths save per-domain cookies and replay them, using the
    // same hashed file name, so a Cloudflare clearance is reused instead of
    // being challenged again on every fetch.
    const sharedBrowser = await readFile("lib/scrapers/browser.ts", "utf8");
    const browserRs = await readFile(
      "desktop/src-tauri/src/scrapers/browser.rs",
      "utf8",
    );

    expect(sharedBrowser).toContain("await context.addCookies(cookies)");
    expect(sharedBrowser).toContain("await saveCookies(domain, cookies)");
    // Same jar directory on both sides.
    for (const part of ['".cache"', '"product-stock-finder"', '"cookies"']) {
      expect(sharedBrowser, `shared jar lost ${part}`).toContain(`  ${part},\n`);
      expect(browserRs, `Rust jar lost ${part}`).toContain(`.join(${part})`);
    }

    expect(browserRs).toContain("fn hash_domain");
    expect(browserRs).toContain("load_cookies(&domain)");
    expect(browserRs).toContain("add_cookies(&saved)");
    expect(browserRs).toContain("save_cookies(&domain, &cookies)");
  });

  it("keeps a single blocked-marker list across the Rust sources", async () => {
    // A third copy in lib.rs had already drifted (a bare "challenge-platform"
    // instead of the full path) while the health probe classifies failures from
    // the message, so both paths must read the same list.
    const modRs = await readFile("desktop/src-tauri/src/scrapers/mod.rs", "utf8");
    const libRs = await readFile("desktop/src-tauri/src/lib.rs", "utf8");
    expect(modRs).toContain("pub const BLOCKED_MARKERS");
    expect(libRs, "lib.rs must not keep its own marker list").not.toContain(
      "BLOCKED_MARKERS: &[&str]",
    );
    expect(libRs).toContain("scrapers::BLOCKED_MARKERS");
    expect(libRs).toContain("scrapers::is_blocked_error");
  });

  it("keeps the desktop snapshot-freshness boundary aligned with the shared parser", async () => {
    // The Rust accepted a snapshot exactly at the TTL (">") where the shared
    // isFreshPriceSnapshot rejects it, so the desktop could stamp an
    // up-to-an-hour-old price as just-checked.
    const ts = await readFile("lib/price-freshness.ts", "utf8");
    const rust = await readFile("desktop/src-tauri/src/lib.rs", "utf8");
    expect(ts).toContain("now - snapshot.fetchedAt < PRICE_SNAPSHOT_TTL_MS");
    expect(rust).toContain("fn is_fresh_snapshot");
    expect(rust).toContain("- fetched_at < SERVER_SNAPSHOT_TTL_MS as f64");
    const tsTests = await readFile("tests/price-freshness.test.ts", "utf8");
    expect(tsTests).toContain("returns false exactly at the TTL boundary");
    expect(rust).toContain("is_fresh_snapshot(now as f64 - ttl, now)");
  });

  it("runs a price check on launch on both platforms", async () => {
    // The mobile evaluates alerts/restock/digest on launch (checkPriceDropsNow);
    // the desktop only started its poller for a non-manual interval, so a
    // manual-only desktop never evaluated any of them.
    const mobileLayout = await readFile("app/_layout.tsx", "utf8");
    const launch = await readFile("desktop/src/lib/launch.ts", "utf8");
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(mobileLayout).toContain("checkPriceDropsNow()");
    expect(launch).toContain("await checkPricesOnce()");
    expect(app).toContain("checkPricesOnce:");
    expect(app).toContain('invoke("run_full_price_check"');
  });

  it("retries a failed sync on foreground on both platforms", async () => {
    // The shared engine has no retry timer; mobile retries from its foreground
    // handler, so the desktop needed the equivalent or a failed sync stayed
    // failed until the next storage change.
    const mobileLayout = await readFile("app/_layout.tsx", "utf8");
    const helper = await readFile("desktop/src/lib/sync-retry.ts", "utf8");
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(mobileLayout).toContain("Retry a failed sync when the app returns to the foreground");
    expect(mobileLayout).toContain("lastSyncError");
    expect(helper).toContain("lastSyncError");
    expect(helper).toContain("createForegroundSyncRetry");
    expect(app).toContain("createForegroundSyncRetry");
    expect(app).toContain('addEventListener("focus", onForeground)');
    expect(app).toContain('addEventListener("visibilitychange", onVisibility)');
  });

  it("unsubscribes local web push on sign-out on both platforms", async () => {
    // Mobile's unregisterPushToken (web branch) unsubscribes; leaving the
    // subscription on the desktop made the push toggle lie after signing out.
    const mobile = await readFile("lib/push-token.ts", "utf8");
    const webPush = await readFile("desktop/src/lib/web-push.ts", "utf8");
    const desktopAuth = await readFile("desktop/src/hooks/use-auth.ts", "utf8");
    expect(mobile).toContain("unsubscribeWebPush()");
    expect(webPush).toContain("export async function unsubscribeLocalWebPush");
    expect(desktopAuth).toContain("unsubscribeLocalWebPush");
  });

  it("records price-check outcomes as health samples on both platforms", async () => {
    // Mobile evaluates health inside runPriceCheckCore (healthCollector.flush);
    // the desktop's probe skips the default "manual" interval, so the desktop
    // must feed its price-check results into the same health service.
    const mobileCheck = await readFile("lib/background-tasks/price-check.ts", "utf8");
    const probe = await readFile("desktop/src/lib/health-probe.ts", "utf8");
    const app = await readFile("desktop/src/App.tsx", "utf8");
    expect(mobileCheck).toContain("healthCollector.flush()");
    expect(probe).toContain("export async function recordHealthFromPriceCheck");
    expect(probe).toContain("recordSample(");
    expect(app).toContain("recordHealthFromPriceCheck");
  });

  it("refreshes a stale verified flag on both platforms", async () => {
    // Verification completes outside the app (an emailed link opened in a
    // browser), so both clients must refresh the cached user or the "check your
    // email" banner survives until a re-login.
    const shared = await readFile("lib/auth-refresh.ts", "utf8");
    const mobile = await readFile("app/verify-email.tsx", "utf8");
    const desktopAuth = await readFile("desktop/src/hooks/use-auth.ts", "utf8");
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(shared).toContain("export async function fetchCurrentUser");
    // The mobile refresh must send the Bearer token: on React Native the
    // session cookie is not reliably sent cross-origin, so /api/auth/me 401'd.
    expect(mobile).toContain("await fetchCurrentUser(");
    expect(mobile).toContain("Authorization: \`Bearer \${sessionToken}\`");
    expect(mobile).toContain("publishAuthUser(");
    expect(desktopAuth).toContain("refreshCurrentUser");
    expect(settings).toContain("refreshCurrentUser()");
  });

  it("repairs products with no listings on both platforms", async () => {
    // A bulk import (and any lost listings) stores `listings: []`, and only
    // discovery fills it — on both the mobile price check and the desktop
    // prices-checked handler.
    const helper = await readFile("lib/manual-add.ts", "utf8");
    const mobile = await readFile("app/_layout.tsx", "utf8");
    const desktop = await readFile("desktop/src/App.tsx", "utf8");
    expect(helper).toContain("export async function rediscoverMissingListings");
    expect(mobile).toContain("rediscoverMissingListings({");
    expect(desktop).toContain("rediscoverMissingListings({");
    expect(mobile).toContain("discoverListings");
    expect(desktop).toContain("discoverListings");
  });
});
