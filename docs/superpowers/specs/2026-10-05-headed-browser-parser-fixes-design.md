# Headed Browser Path + Cloudflare-Hard Parser Fixes — Design Spec

**Date:** 2026-10-05
**Goal:** Make the three "unfixable" Cloudflare-hard distributors (Winncom, B&H Photo, GoWiFi) actually return prices, by (a) letting the server browser run headed and (b) correcting the three parsers' selectors/URLs.

## Problem

Phase 1102 documented Winncom / B&H / GoWiFi as blocked even for Playwright. Direct measurement on 2026-10-05 changes that conclusion:

| Mode | Winncom | B&H |
| --- | --- | --- |
| bundled Chromium, headless | 403 blocked | 403 blocked |
| system Chromium, headless | 403 blocked | 403 blocked |
| `--headless=new` | 403 blocked | 403 blocked |
| **headed (bundled or system)** | **200** | **200** |

The gate keys on **headed-ness**, not on system-Chrome-vs-bundled (the Phase 1103 conclusion was incomplete). A headless UA override passes Winncom but not B&H, so headed is required for B&H.

Even unblocked, the parsers return no price because their selectors no longer match the current DOM:

- **B&H** — the price is `[data-selenium='uppedDecimalPriceFirst']` (`$209`), but the product card is `[data-selenium='miniProductPageProduct']`, which is not in the shared `CARD_SELECTORS`, so `modelMismatch` never reaches the "CRS326" name and rejects the price.
- **Winncom** — the price is a `<a href="/login">$209.00</a>` inside the `<td>` that holds `.yourpricediscounted`; the configured selectors (`.product-price`, `.price`, …) match nothing.
- **GoWiFi** — the search URL is wrong: the store is VirtueMart, so `https://gowifi.co.nz/search?q=…` 404s. The real endpoint is `/index.php?option=com_virtuemart&view=category&search=true&…&keyword=…`, which returned 200 with `.product-price` values (`$419.00` → 419, NZD) on first contact. **Caveat:** after repeated automated probes the site began returning 403 consistently, so GoWiFi appears to rate-limit aggressive automation even headed. The URL fix is correct; whether it works in production depends on request pacing (the parser's `rateLimitMs` and the breaker cooldown).

## Scope

**In scope:** an opt-in headed launch for the server browser; the three parser fixes; real-DOM fixtures + tests; an Xvfb deployment note.

**Out of scope:** mobile/desktop browser paths (they use the WebView/Rust renderers, not `lib/scrapers/browser.ts`); a headless-only bypass (none exists for B&H); auto-spawning Xvfb from Node.

## Architecture

### 1. Opt-in headed launch — `lib/scrapers/browser.ts`

`launchBrowser()` currently hardcodes `headless: true`. Change it to read an explicit env opt-in:

```ts
export async function launchBrowser(): Promise<Browser> {
  const headless = process.env.PSF_BROWSER_HEADED !== "1";
  const opts = { headless, args: LAUNCH_ARGS };
  try {
    return await chromium.launch({ ...opts, channel: "chrome" });
  } catch {
    return await chromium.launch(opts);
  }
}
```

- Default (`PSF_BROWSER_HEADED` unset) is **unchanged** — headless. Dev machines never pop windows.
- Production sets `PSF_BROWSER_HEADED=1` and runs the server under a virtual display (`xvfb-run -a pnpm start` or a systemd unit with `Xvfb`). Headed Chromium needs `DISPLAY`.
- The system-Chrome-then-bundled fallback is preserved.

### 2. B&H card selector — `lib/scrapers/utils.ts`

Add `[data-selenium='miniProductPageProduct']` to `CARD_SELECTORS`. It is B&H-specific, matching the existing pattern (`.aerial-card`, `.ac-item` are already distributor-specific). For other sites the selector matches nothing, so their model matching is unaffected.

### 3. Winncom price selector — `lib/scrapers/winncom.ts`

Add `td:has(.yourpricediscounted)` to the price selector list. It matches the one price cell (`$209.00Sale Price:Login` → 209) and its enclosing `<tr>` names the model, so the gate passes.

### 4. GoWiFi search URL — `lib/scrapers/gowifi.ts`

Replace `buildSearchUrl` with the VirtueMart endpoint:

```ts
buildSearchUrl: (model) =>
  `https://www.gowifi.co.nz/index.php?option=com_virtuemart&view=category&search=true&limitstart=0&lang=en&virtuemart_category_id=0&keyword=${encodeURIComponent(model)}`,
```

The existing `.product-price` selector already parses the result page (`$419.00` → 419, NZD).

## Data Flow

1. `prices.get` → `resilientFetch` → plain blocked → browser path.
2. With `PSF_BROWSER_HEADED=1` + a display, the browser loads the page unblocked (200).
3. The corrected parser extracts the price and the model gate confirms the product.

## Error Handling

- No display / headed launch fails → the existing bundled fallback still runs; if that fails, the block stands (breaker records it) and the Phase 1105 provider is the last resort.
- A parser that still finds no price returns `null` exactly as today.

## Security & Privacy

- No new data flows; the browser loads the same parser-derived URLs.
- The env opt-in is server-only; mobile/web/desktop are untouched.

## Testing

- `tests/scrapers/browser-launch.test.ts` — default is headless; `PSF_BROWSER_HEADED=1` launches headed; system-Chrome-then-bundled fallback still holds.
- `tests/scrapers/bhphoto.test.ts` / `winncom.test.ts` / `gowifi.test.ts` — new real-DOM fixtures parse the expected price; the existing 404/mismatch cases stay green.
- New minimal fixtures under `tests/fixtures/scrapers/` (`bhphoto-us-price.html`, `winncom-us-price.html`, `gowifi-nz-price.html`) containing only the relevant product card, so the tests exercise the exact selectors without committing 460 KB of page HTML.

## Risks & Mitigations

- **Headed is heavier / needs a display** → opt-in only; default unchanged; documented Xvfb requirement.
- **B&H's hashed CSS-module classes are unstable** → the fix anchors on the stable `data-selenium` attributes, not the hashed classes.
- **A shared `CARD_SELECTORS` addition could affect other parsers** → the selector is B&H-specific and matches nothing elsewhere; the full scraper suite guards this.

## Success Criteria

- With `PSF_BROWSER_HEADED=1` under Xvfb, Winncom and B&H return 200 and their parsers extract a price; GoWiFi's corrected URL returns 200 and extracts a price.
- Default (no env) behavior is byte-for-byte unchanged.
- `pnpm verify` stays green.
