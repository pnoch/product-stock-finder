# Headed Browser Path + Cloudflare-Hard Parser Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the server browser run headed (opt-in) so Winncom/B&H stop returning 403, and fix the B&H, Winncom, and GoWiFi parsers so they extract the price from the current DOM.

**Architecture:** `launchBrowser()` gains a `PSF_BROWSER_HEADED=1` opt-in (default unchanged). Three parser fixes: a B&H card selector in the shared `CARD_SELECTORS`, a Winncom price selector, and GoWiFi's VirtueMart search URL. Real-DOM fixtures make each parser test non-vacuous.

**Tech Stack:** TypeScript, patchright, cheerio, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-headed-browser-parser-fixes-design.md`

---

## File Structure

- Modify `lib/scrapers/browser.ts` — headed opt-in in `launchBrowser()`.
- Modify `lib/scrapers/utils.ts` — add the B&H card selector to `CARD_SELECTORS`.
- Modify `lib/scrapers/winncom.ts` — add the price-cell selector.
- Modify `lib/scrapers/gowifi.ts` — VirtueMart `buildSearchUrl`.
- Create fixtures `tests/fixtures/scrapers/{bhphoto-us-price,winncom-us-price,gowifi-nz-price}.html`.
- Tests: `tests/scrapers/browser-launch.test.ts` (extend), `bhphoto.test.ts`, `winncom.test.ts`, `gowifi.test.ts` (extend).

---

### Task 1: Opt-in headed launch

**Files:** Modify `lib/scrapers/browser.ts:109-114`; Test `tests/scrapers/browser-launch.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/scrapers/browser-launch.test.ts` (inside the existing `describe("launchBrowser", …)`):

```ts
  it("launches headed when PSF_BROWSER_HEADED=1", async () => {
    const prev = process.env.PSF_BROWSER_HEADED;
    process.env.PSF_BROWSER_HEADED = "1";
    try {
      const chrome = { isConnected: () => true };
      launch.mockResolvedValueOnce(chrome);
      await expect(launchBrowser()).resolves.toBe(chrome);
      expect(launch.mock.calls[0][0]).toMatchObject({
        headless: false,
        channel: "chrome",
      });
    } finally {
      if (prev === undefined) delete process.env.PSF_BROWSER_HEADED;
      else process.env.PSF_BROWSER_HEADED = prev;
    }
  });

  it("stays headless when PSF_BROWSER_HEADED is unset", async () => {
    const prev = process.env.PSF_BROWSER_HEADED;
    delete process.env.PSF_BROWSER_HEADED;
    try {
      const chrome = { isConnected: () => true };
      launch.mockResolvedValueOnce(chrome);
      await launchBrowser();
      expect(launch.mock.calls[0][0]).toMatchObject({ headless: true });
    } finally {
      if (prev !== undefined) process.env.PSF_BROWSER_HEADED = prev;
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/scrapers/browser-launch.test.ts`
Expected: FAIL — the headed test sees `headless: true`.

- [ ] **Step 3: Implement**

Replace `launchBrowser` in `lib/scrapers/browser.ts`:

```ts
// Prefer the host's real Chrome (its TLS/JA4 and version shape pass more
// anti-bot gates than bundled Chromium); fall back when Chrome isn't installed.
// Headed mode is an explicit opt-in: Cloudflare's gate keys on headed-ness, so
// production sets PSF_BROWSER_HEADED=1 and runs under a virtual display
// (Xvfb). Default stays headless so dev machines never pop windows.
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scrapers/browser-launch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/browser.ts tests/scrapers/browser-launch.test.ts
git commit -m "feat(scrapers): opt-in headed browser launch (PSF_BROWSER_HEADED)"
```

---

### Task 2: B&H card selector

**Files:** Modify `lib/scrapers/utils.ts:240-241`; Create `tests/fixtures/scrapers/bhphoto-us-price.html`; Test `tests/scrapers/bhphoto.test.ts`

- [ ] **Step 1: Create the fixture**

Create `tests/fixtures/scrapers/bhphoto-us-price.html`:

```html
<html><body>
<div data-selenium="miniProductPageProduct">
  <a data-selenium="miniProductPageProductNameLink" href="/c/product/1877198-REG/mikrotik_crs326_24g_2s_rm.html">MikroTik CRS326-24G-2S+RM 24-Port Gigabit Managed Network Switch</a>
  <div data-selenium="miniProductPagePricingDealZone">
    <div data-selenium="miniProductPageProductConversion">
      <div class="container_x6DXwdw1Fb listingContainer_x6DXwdw1Fb">
        <div class="pricesContainer_x6DXwdw1Fb">
          <div class="priceWrapper_x6DXwdw1Fb">
            <span class="text_TAw0W35QK_"><span class="price_x6DXwdw1Fb"><span class="container_g3a3KcfvMV" data-selenium="uppedDecimalPrice"><span data-selenium="uppedDecimalPriceFirst">$209</span><sup data-selenium="uppedDecimalPriceSecond">00</sup></span></span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>
```

- [ ] **Step 2: Write the failing test**

Append to `tests/scrapers/bhphoto.test.ts`:

```ts
describe("B&H current DOM (data-selenium)", () => {
  it("extracts the price from the miniProductPage card", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES_DIR, "bhphoto-us-price.html"),
      "utf-8",
    );
    const result = bhphotoParser.parsePrice(html, "CRS326-24G-2S+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(209);
    expect(result!.currency).toBe("USD");
  });

  it("rejects the price when the card names a different model", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES_DIR, "bhphoto-us-price.html"),
      "utf-8",
    );
    expect(bhphotoParser.parsePrice(html, "CRS804-4DDQ-hRM")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/bhphoto.test.ts`
Expected: FAIL — the first new test returns null (the card is 6 levels above the price, beyond the 4-level walk-up, so `modelMismatch` rejects it).

- [ ] **Step 4: Implement**

In `lib/scrapers/utils.ts`, add the B&H card selector to `CARD_SELECTORS`:

```ts
const CARD_SELECTORS =
  "article, .product, .product-item, .productitem, .product-item-details, .product-item-info, .product-card, .aerial-card, .ac-item, [data-selenium='miniProductPageProduct']";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/bhphoto.test.ts tests/scrapers/utils.test.ts`
Expected: PASS (the new tests plus the existing suite).

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/utils.ts tests/fixtures/scrapers/bhphoto-us-price.html tests/scrapers/bhphoto.test.ts
git commit -m "fix(scrapers): match B&H's miniProductPage card so the model gate passes"
```

---

### Task 3: Winncom price selector

**Files:** Modify `lib/scrapers/winncom.ts:26-31`; Create `tests/fixtures/scrapers/winncom-us-price.html`; Test `tests/scrapers/winncom.test.ts`

- [ ] **Step 1: Create the fixture**

Create `tests/fixtures/scrapers/winncom-us-price.html`:

```html
<html><body><table class="products-table"><tbody>
<tr>
  <td>CRS326-24G-2S+RM</td>
  <td>Cloud Router Switch 326-24G-2S+RM with 800MHz CPU, 512MB RAM</td>
  <td><a href="/login">$209.00</a><br><span class="yourpricediscounted">Sale Price:</span></td>
</tr>
</tbody></table></body></html>
```

- [ ] **Step 2: Write the failing test**

Append to `tests/scrapers/winncom.test.ts`:

```ts
describe("Winncom current DOM (price cell)", () => {
  it("extracts the price from the td holding the sale-price marker", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES_DIR, "winncom-us-price.html"),
      "utf-8",
    );
    const result = winncomParser.parsePrice(html, "CRS326-24G-2S+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(209);
    expect(result!.currency).toBe("USD");
  });

  it("rejects the price when the row names a different model", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES_DIR, "winncom-us-price.html"),
      "utf-8",
    );
    expect(winncomParser.parsePrice(html, "CRS804-4DDQ-hRM")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/winncom.test.ts`
Expected: FAIL — the first new test returns null (no configured selector matches the price cell).

- [ ] **Step 4: Implement**

In `lib/scrapers/winncom.ts`, add the price-cell selector:

```ts
  const $price = findPriceElement(
    $,
    ".product-price, [data-product-price], [data-price-container], .price, td:has(.yourpricediscounted)",
    model,
  );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/winncom.test.ts`
Expected: PASS (including the existing "does not parse the model number as the price" regression).

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/winncom.ts tests/fixtures/scrapers/winncom-us-price.html tests/scrapers/winncom.test.ts
git commit -m "fix(scrapers): match Winncom's price cell (td:has(.yourpricediscounted))"
```

---

### Task 4: GoWiFi search URL

**Files:** Modify `lib/scrapers/gowifi.ts:41-42`; Create `tests/fixtures/scrapers/gowifi-nz-price.html`; Test `tests/scrapers/gowifi.test.ts`

- [ ] **Step 1: Create the fixture**

Create `tests/fixtures/scrapers/gowifi-nz-price.html`:

```html
<html><body><div class="product product-item">
  <div class="product-inner">
    <a href="/shop/mikrotik-crs326">MikroTik CRS326-24G-2S+RM</a>
    <div class="product-price-cont"><div class="product-price">$419.00 +GST</div></div>
  </div>
</div></body></html>
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/scrapers/gowifi.test.ts`:

```ts
describe("GoWiFi VirtueMart search", () => {
  it("builds the VirtueMart search URL", () => {
    expect(gowifiParser.buildSearchUrl("CRS326")).toBe(
      "https://www.gowifi.co.nz/index.php?option=com_virtuemart&view=category&search=true&limitstart=0&lang=en&virtuemart_category_id=0&keyword=CRS326",
    );
  });

  it("extracts the price from the VirtueMart product card", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES_DIR, "gowifi-nz-price.html"),
      "utf-8",
    );
    const result = gowifiParser.parsePrice(html, "CRS326-24G-2S+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(419);
    expect(result!.currency).toBe("NZD");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/gowifi.test.ts`
Expected: FAIL — `buildSearchUrl` returns the old `/search?q=` URL.

- [ ] **Step 4: Implement**

In `lib/scrapers/gowifi.ts`, replace `buildSearchUrl`:

```ts
  buildSearchUrl: (model) =>
    `https://www.gowifi.co.nz/index.php?option=com_virtuemart&view=category&search=true&limitstart=0&lang=en&virtuemart_category_id=0&keyword=${encodeURIComponent(model)}`,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/gowifi.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/gowifi.ts tests/fixtures/scrapers/gowifi-nz-price.html tests/scrapers/gowifi.test.ts
git commit -m "fix(scrapers): use GoWiFi's VirtueMart search endpoint"
```

---

### Task 5: Full verification + docs

**Files:** `todo.md`; `AGENTS.md` (env note)

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0 (root tests, desktop, cargo all green).

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1106): the headed opt-in (`PSF_BROWSER_HEADED=1` + Xvfb), the three parser fixes, and the measured evidence (headed 200 vs headless 403; GoWiFi rate-limit caveat). Add one line to `AGENTS.md` under Environment noting `PSF_BROWSER_HEADED=1` requires a display (Xvfb) and is server-only.

- [ ] **Step 3: Commit**

```bash
git add todo.md AGENTS.md
git commit -m "docs: headed browser path + Cloudflare-hard parser fixes (Phase 1106)"
```

---

## Self-Review

- **Spec coverage:** headed opt-in (Task 1), B&H card selector (Task 2), Winncom selector (Task 3), GoWiFi URL (Task 4), verify + docs (Task 5). Mobile/desktop paths and a headless-only bypass are out of scope per the spec.
- **Placeholders:** none.
- **Type consistency:** `launchBrowser(): Promise<Browser>`; `PSF_BROWSER_HEADED` env; `CARD_SELECTORS` string; `findPriceElement($, selector, model)`; `gowifiParser.buildSearchUrl(model)` — used consistently.
- **Non-vacuousness:** the B&H fixture nests the price 6 levels below the card (beyond the 4-level walk-up), so it fails without the card-selector change and passes with it; the Winncom fixture has no `.price`/`.product-price` class, so it fails without the new selector.
