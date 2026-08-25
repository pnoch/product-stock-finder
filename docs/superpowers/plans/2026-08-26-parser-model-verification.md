# Parser Model-Number Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit finding #12 — every scraper parser verifies that the element it prices actually corresponds to the requested model number, returning a miss (`null`) when it doesn't, so wrong-product prices never enter cache or price history.

**Architecture:** Three shared helpers land in `lib/scrapers/utils.ts` (`matchesModel` boundary-aware matcher, `productRowContext` container extractor, `modelMismatch` gate). `DistributorParser.parsePrice` gains an optional `model` parameter; all 25 parsers capture the priced element, apply the gate, and thread the model from their `scrapeXxx` helpers. Both production call sites (`server/prices.ts`, `lib/background-tasks/refresh-listing.ts`) pass the model through.

**Tech Stack:** cheerio 1.2, TypeScript strict, vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-parser-model-verification-design.md`

---

### Task 1: Shared helpers in `lib/scrapers/utils.ts`

**Files:**
- Modify: `lib/scrapers/utils.ts`
- Create: `tests/scrapers/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/scrapers/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import {
  matchesModel,
  productRowContext,
  modelMismatch,
} from "../../lib/scrapers/utils";

describe("matchesModel", () => {
  it("matches the spec-table positives", () => {
    expect(
      matchesModel("MikroTik CRS804-4DDQ-hRM RouterOS7", "CRS804-4DDQ-hRM"),
    ).toBe(true);
    expect(matchesModel("hEX-S (RouterOS L4)", "hEX S")).toBe(true);
    expect(matchesModel("crs326 24g 2s plus switch", "CRS326-24G-2S+")).toBe(
      true,
    );
  });

  it("rejects prefix/suffix SKU extensions", () => {
    expect(matchesModel("RB5009UG+S+IN", "RB5009")).toBe(false);
    expect(matchesModel("hEX", "hEX S")).toBe(false);
  });

  it("rejects embedded occurrences", () => {
    expect(matchesModel("xRB5009y", "RB5009")).toBe(false);
    expect(matchesModel("4032CRS804 kit", "CRS804")).toBe(false);
  });

  it("is case-insensitive and separator-flexible", () => {
    expect(matchesModel("mikrotik crs804-4ddq-hrm", "crs8044ddqhrm")).toBe(
      true,
    );
    expect(matchesModel("RB5009UG+S+IN", "rb5009ug s in")).toBe(true);
  });

  it("accepts when only a later candidate sits on boundaries", () => {
    expect(matchesModel("xRB5009 y RB5009 z", "RB5009")).toBe(true);
  });

  it("returns false for empty or unusable inputs", () => {
    expect(matchesModel("", "RB5009")).toBe(false);
    expect(matchesModel("some text", "")).toBe(false);
    expect(matchesModel("some text", "   ")).toBe(false);
  });
});

describe("productRowContext", () => {
  const ROW_HTML = `<html><body><table>
    <tr class="product">
      <td><a href="/p/crs804">MikroTik CRS804</a></td>
      <td><span class="price">$480.00</span></td>
    </tr>
  </table></body></html>`;

  it("climbs to the row container and extracts text + href", () => {
    const $ = cheerio.load(ROW_HTML);
    const ctx = productRowContext($, $(".price").first());
    expect(ctx.text).toContain("MikroTik CRS804");
    expect(ctx.href).toBe("/p/crs804");
  });

  it("falls back to the element itself when no container matches", () => {
    const $ = cheerio.load(`<div><span class="price">$5.00</span></div>`);
    const ctx = productRowContext($, $(".price").first());
    expect(ctx.text).toContain("$5.00");
    expect(ctx.href).toBe("");
  });
});

describe("modelMismatch", () => {
  const $ = cheerio.load(ROW_HTML);

  it("is false when no model is provided", () => {
    expect(modelMismatch($, $(".price").first(), undefined)).toBe(false);
  });

  it("is true when the row names a different product", () => {
    expect(modelMismatch($, $(".price").first(), "CRS326-24G-2S+")).toBe(true);
  });

  it("is false when the row names the requested product", () => {
    expect(modelMismatch($, $(".price").first(), "CRS804")).toBe(false);
  });

  it("accepts (false) when the context is empty", () => {
    const bare = cheerio.load(`<span class="price">$5.00</span>`);
    expect(modelMismatch(bare, bare(".price").first(), "CRS804")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/scrapers/utils.test.ts`
Expected: FAIL — `matchesModel`, `productRowContext`, `modelMismatch` are not exported.

- [ ] **Step 3: Implement the helpers**

In `lib/scrapers/utils.ts`, add imports at the top (after the existing imports):

```ts
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
```

Append at the end of the file:

```ts
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesModel(text: string, model: string): boolean {
  const needle = model.trim();
  if (!needle || !text) return false;
  let pattern = "";
  for (const ch of needle) {
    pattern += /[a-z0-9]/i.test(ch) ? escapeRegExp(ch) : "[^a-z0-9]*?";
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern, "gi");
  } catch {
    return false;
  }
  for (const match of text.matchAll(re)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start > 0 ? text[start - 1]! : "";
    const after = end < text.length ? text[end]! : "";
    if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) return true;
  }
  return false;
}

export function productRowContext(
  $: CheerioAPI,
  $el: Cheerio<Element>,
): { text: string; href: string } {
  const row = $el
    .closest("tr, article, .product, .product-item, .item, .product-card, li")
    .first();
  const container = row.length ? row : $el;
  const href = container.find("a[href]").first().attr("href") ?? "";
  return { text: container.text(), href };
}

export function modelMismatch(
  $: CheerioAPI,
  $el: Cheerio<Element>,
  model?: string,
): boolean {
  if (!model) return false;
  const { text, href } = productRowContext($, $el);
  if (!text.trim() && !href) return false;
  return !(matchesModel(text, model) || matchesModel(href, model));
}
```

Note: `domhandler` is a direct transitive dependency of cheerio 5.x typings and resolves fine under `pnpm`'s hoisted node_modules (`.npmrc` uses `node-linker=hoisted`). If tsc cannot resolve it, change the `$el` type to `Cheerio<cheerio.Element>` — whichever compiles; do not change behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/scrapers/utils.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/utils.ts tests/scrapers/utils.test.ts
git commit -m "feat: add boundary-aware model matcher and row-context helpers"
```

---

### Task 2: Parser contract + call sites

**Files:**
- Modify: `lib/scrapers/types.ts:16`
- Modify: `server/prices.ts` (inside `refreshPrice`)
- Modify: `lib/background-tasks/refresh-listing.ts:73`

- [ ] **Step 1: Extend the contract**

In `lib/scrapers/types.ts`, replace:

```ts
  parsePrice: (html: string) => ScrapeResult | null;
```

with:

```ts
  parsePrice: (html: string, model?: string) => ScrapeResult | null;
```

The parameter is optional, so all 25 existing parser objects keep compiling unchanged until Tasks 3-5 migrate them.

- [ ] **Step 2: Thread the model through the server path**

In `server/prices.ts`, inside `refreshPrice`, replace:

```ts
    const result = parser.parsePrice(outcome.html);
```

with:

```ts
    const result = parser.parsePrice(outcome.html, modelNumber);
```

- [ ] **Step 3: Thread the model through the client background path**

In `lib/background-tasks/refresh-listing.ts`, inside the `try` block, replace:

```ts
    const result = parser.parsePrice(outcome.html);
```

with:

```ts
    const result = parser.parsePrice(outcome.html, product.modelNumber);
```

- [ ] **Step 4: Verify nothing regressed**

Run: `pnpm check && pnpm vitest run tests/prices.test.ts tests/price-check.test.ts tests/scraping-integration.test.ts tests/server-first-scrape.test.ts tests/warmer.test.ts`
Expected: typecheck 0 errors; all listed suites PASS (parsers ignore the extra arg until migrated; mocked registries unaffected).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/types.ts server/prices.ts lib/background-tasks/refresh-listing.ts
git commit -m "feat: thread requested model into parsePrice at both scrape call sites"
```

---

### Task 3: Migrate group 1 — the `.product-price, .price, [data-product-price]` parsers

Nine parsers share this exact recipe. For each file below: (a) extend the utils import with `modelMismatch`, (b) rewrite the `parseHtml` head exactly as shown, (c) update the parser object's `parsePrice` lambda, (d) update `scrapeXxx`'s return, (e) append the verification test block.

**Files:**
- Modify: `lib/scrapers/duxtel.ts`, `lib/scrapers/gearup.ts`, `lib/scrapers/gowifi.ts`, `lib/scrapers/hellascom.ts`, `lib/scrapers/linktechs.ts`, `lib/scrapers/nasstore.ts`, `lib/scrapers/networkdevices.ts`, `lib/scrapers/pbtech.ts`, `lib/scrapers/wisp.ts`
- Test: `tests/scrapers/duxtel.test.ts`, `tests/scrapers/gearup.test.ts`, `tests/scrapers/gowifi.test.ts`, `tests/scrapers/hellascom.test.ts`, `tests/scrapers/linktechs.test.ts`, `tests/scrapers/nasstore.test.ts`, `tests/scrapers/networkdevices.test.ts`, `tests/scrapers/pbtech.test.ts`, `tests/scrapers/wisp.test.ts`

- [ ] **Step 1: Apply the canonical edit to each parser**

The canonical change (shown for `lib/scrapers/duxtel.ts`; substitute the file's own base URL constant in the `parsePrice` lambda — the value stays whatever it is today):

Import line — replace:

```ts
import {
  fetchWithRateLimit,
  parsePriceFromText,
  inferStockStatus,
} from "./utils";
```

with (add `modelMismatch`; keep `fetchWithParser` instead of `fetchWithRateLimit` for gowifi, pbtech, wisp which import that):

```ts
import {
  fetchWithRateLimit,
  parsePriceFromText,
  inferStockStatus,
  modelMismatch,
} from "./utils";
```

Function head — replace:

```ts
function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .price, [data-product-price]")
    .first()
    .text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;
```

with:

```ts
function parseHtml(html: string, url: string, model?: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = $(".product-price, .price, [data-product-price]").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($, $price, model)) return null;
```

(`pbtech.ts` uses selector order `.price, .product-price, [data-product-price]` — keep its order, same shape.)

Parser object — replace (example URL is duxtel's; keep each file's own):

```ts
  parsePrice: (html) => parseHtml(html, "https://store.duxtel.com"),
```

with:

```ts
  parsePrice: (html, model) => parseHtml(html, "https://store.duxtel.com", model),
```

Scrape helper — replace:

```ts
    return parseHtml(html, url);
```

with:

```ts
    return parseHtml(html, url, model);
```

Apply (a)-(d) to all nine files. Per-file selector notes: all nine use the identical price selector except `pbtech.ts` noted above; nothing else varies.

- [ ] **Step 2: Append the verification test block to each of the nine test files**

Each test file already imports its parser object (e.g. `import { duxtelParser } from "../../lib/scrapers/duxtel";` — reuse the existing import; add none if present). Append at file end (top level, outside any describe):

```ts
describe("model verification", () => {
  const MODEL = "CRS804-4DDQ-hRM";
  const MATCH_HTML = `<html><body><table><tr class="product">
    <td><span class="price nobr product-price" data-product-price data-price-container>$480.00</span>
    <a class="product-link" href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a></td>
    <td><span class="stock-status availability stock">In Stock</span></td>
  </tr></table></body></html>`;
  const MISMATCH_HTML = MATCH_HTML.replace(
    /crs804-4ddq-hrm/g,
    "crs326-24g-2s-plus",
  ).replace(/CRS804-4DDQ-hRM/g, "CRS326-24G-2S+");

  it("accepts a row that names the requested model", () => {
    const result = PARSER.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(PARSER.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(PARSER.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });
});
```

Substitute `PARSER` with the file's exported parser object name: `duxtelParser` (duxtel.test.ts), `gearupParser` (gearup.test.ts), `gowifiParser` (gowifi.test.ts), `hellascomParser` (hellascom.test.ts), `linktechsParser` (linktechs.test.ts), `nasstoreParser` (nasstore.test.ts), `networkdevicesParser` (networkdevices.test.ts), `pbtechParser` (pbtech.test.ts), `wispParser` (wisp.test.ts).

- [ ] **Step 3: Run the group's tests to verify they pass**

Run: `pnpm vitest run tests/scrapers/duxtel.test.ts tests/scrapers/gearup.test.ts tests/scrapers/gowifi.test.ts tests/scrapers/hellascom.test.ts tests/scrapers/linktechs.test.ts tests/scrapers/nasstore.test.ts tests/scrapers/networkdevices.test.ts tests/scrapers/pbtech.test.ts tests/scrapers/wisp.test.ts`
Expected: PASS — including the three new cases per file.

- [ ] **Step 4: Commit**

```bash
git add lib/scrapers/duxtel.ts lib/scrapers/gearup.ts lib/scrapers/gowifi.ts \
  lib/scrapers/hellascom.ts lib/scrapers/linktechs.ts lib/scrapers/nasstore.ts \
  lib/scrapers/networkdevices.ts lib/scrapers/pbtech.ts lib/scrapers/wisp.ts \
  tests/scrapers/
git commit -m "feat: verify scraped model on product-price parser group"
```

---

### Task 4: Migrate group 2 — ten more parsers

**Files:**
- Modify: `lib/scrapers/aerial.ts`, `lib/scrapers/bhphoto.ts`, `lib/scrapers/getic.ts`, `lib/scrapers/mega.ts`, `lib/scrapers/miro.ts`, `lib/scrapers/multilink.ts`, `lib/scrapers/mikrotikstore.ts`, `lib/scrapers/neobits.ts`, `lib/scrapers/rocnoc.ts`, `lib/scrapers/server2u.ts`
- Test: matching files in `tests/scrapers/`

- [ ] **Step 1: Apply the canonical edit to each parser**

Same four-part change as Task 3 Step 1 (import `modelMismatch`; capture `$price`; gate; thread `model` through `parsePrice` lambda and `scrapeXxx`). These files import `{ fetchWithParser, ... }` except `neobits.ts`, `rocnoc.ts`, `server2u.ts`, `mikrotikstore.ts` which import `{ fetchWithRateLimit, ... }` — preserve each file's existing fetch import.

Per-file price selector (keep order; only the capture changes):

| File | Price selector (unchanged) |
| --- | --- |
| aerial.ts | `.ac-price, .product-price, .price` |
| bhphoto.ts | `.price, [data-selenium='uppedDecimalPriceFirst'], .product-price` |
| getic.ts | `.price, [data-testid='price'], .product-price` |
| mega.ts | `.product-price, .price, [data-price], [itemprop='price']` |
| miro.ts | `.product-price, .price, [data-price], [itemprop='price']` |
| multilink.ts | `.product-price, .price--withoutTax, [data-product-price-without-tax], .price` |
| mikrotikstore.ts | `.product-price, .product-detail-price, [itemprop='price'], .price` |
| neobits.ts | `.product-price, .price4, .price` |
| rocnoc.ts | `.price, .product-price, td:contains('$')` |
| server2u.ts | `.product-price, .price, [data-product-price], [itemprop='price']` |

Example head for `aerial.ts` after the edit:

```ts
function parseHtml(html: string, url: string, model?: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = $(".ac-price, .product-price, .price").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($, $price, model)) return null;
```

and its object/scrape lines become:

```ts
  parsePrice: (html, model) => parseHtml(html, "https://aerial.net", model),
```

```ts
    return parseHtml(html, url, model);
```

- [ ] **Step 2: Append the verification test block to each of the ten test files**

Identical block to Task 3 Step 2 (same `MATCH_HTML`/`MISMATCH_HTML` fixtures work: every selector in the table above matches the fixture's `.price.product-price` span). Substitute `PARSER`: `aerialParser`, `bhphotoParser`, `geticParser`, `megaParser`, `miroParser`, `multilinkParser`, `mikrotikstoreParser`, `neobitsParser`, `rocnocParser`, `server2uParser`.

One exception — `rocnoc.ts`: its selector `td:contains('$')` can match the fixture's outer `<td>` wrapping both cells in some cheerio versions, making context climb to the same `tr` either way; the fixture works unmodified.

- [ ] **Step 3: Run the group's tests to verify they pass**

Run: `pnpm vitest run tests/scrapers/aerial.test.ts tests/scrapers/bhphoto.test.ts tests/scrapers/getic.test.ts tests/scrapers/mega.test.ts tests/scrapers/miro.test.ts tests/scrapers/multilink.test.ts tests/scrapers/mikrotikstore.test.ts tests/scrapers/neobits.test.ts tests/scrapers/rocnoc.test.ts tests/scrapers/server2u.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/scrapers/aerial.ts lib/scrapers/bhphoto.ts lib/scrapers/getic.ts \
  lib/scrapers/mega.ts lib/scrapers/miro.ts lib/scrapers/multilink.ts \
  lib/scrapers/mikrotikstore.ts lib/scrapers/neobits.ts lib/scrapers/rocnoc.ts \
  lib/scrapers/server2u.ts tests/scrapers/
git commit -m "feat: verify scraped model on mixed-selector parser group"
```

---

### Task 5: Migrate group 3 — the last six parsers

**Files:**
- Modify: `lib/scrapers/flytec.ts`, `lib/scrapers/mbsiwav.ts`, `lib/scrapers/interprojekt.ts`, `lib/scrapers/balticnetworks.ts`, `lib/scrapers/linitx.ts`, `lib/scrapers/winncom.ts`
- Test: matching files in `tests/scrapers/`

- [ ] **Step 1: Apply the canonical edit to each parser**

Same four-part change. Price selectors (unchanged, captured into `$price`):

| File | Price selector |
| --- | --- |
| flytec.ts | `[data-product-price-without-tax], .price--withoutTax.price-primary, .price-section--withoutTax, .price` |
| mbsiwav.ts | `.product-views-price, .product-views-price-exact, .product-views-price-lead, .price` |
| interprojekt.ts | `.price` |
| balticnetworks.ts | `.price__current, [data-price-container], .productitem__price` |
| linitx.ts | `.prodprice, .product__price, .price` |
| winncom.ts | `.product-link, .nobr, td a[href*='/products/'], .price` |

Fetch imports: `flytec`, `interprojekt`, `balticnetworks`, `linitx` use `fetchWithRateLimit`; `mbsiwav`, `winncom` use `fetchWithParser`. Preserve as-is.

`parsePrice` lambdas keep each site's URL, e.g.:

```ts
  parsePrice: (html, model) => parseHtml(html, "https://winncom.com", model),
```

- [ ] **Step 2: Append the verification test block to each of the six test files**

Same block as Task 3 Step 2. Fixture compatibility notes:
- `balticnetworksParser` matches via `[data-price-container]` ✓; `linitxParser` via `.price` ✓; `flytecParser` via `.price` ✓; `mbsiwavParser` via `.price` ✓; `interprojektParser` via `.price` ✓.
- `winncomParser`: the fixture's first doc-order match is `span.price.nobr` (contains `$480.00`) ✓, and its row context includes the anchor title/href ✓.

Substitute `PARSER`: `flytecParser`, `mbsiwavParser`, `interprojektParser`, `balticnetworksParser`, `linitxParser`, `winncomParser`.

- [ ] **Step 3: Run the group's tests to verify they pass**

Run: `pnpm vitest run tests/scrapers/flytec.test.ts tests/scrapers/mbsiwav.test.ts tests/scrapers/interprojekt.test.ts tests/scrapers/balticnetworks.test.ts tests/scrapers/linitx.test.ts tests/scrapers/winncom.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/scrapers/flytec.ts lib/scrapers/mbsiwav.ts lib/scrapers/interprojekt.ts \
  lib/scrapers/balticnetworks.ts lib/scrapers/linitx.ts lib/scrapers/winncom.ts \
  tests/scrapers/
git commit -m "feat: verify scraped model on remaining parser group"
```

---

### Task 6: Global regression guard + full verification

**Files:**
- Modify: `tests/scraping-integration.test.ts`

- [ ] **Step 1: Add a cross-parser guard test**

In `tests/scraping-integration.test.ts`, append this describe at file end (inside the top-level `describe("Scraping Integration")` block, after the last nested describe):

```ts
  describe("Model Verification", () => {
    const MATCH_HTML = `<html><body><table><tr class="product">
      <td><span class="price nobr product-price" data-product-price data-price-container>$480.00</span>
      <a class="product-link" href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a></td>
      <td><span class="stock-status availability stock">In Stock</span></td>
    </tr></table></body></html>`;
    const MISMATCH_HTML = MATCH_HTML.replace(
      /crs804-4ddq-hrm/g,
      "crs326-24g-2s-plus",
    ).replace(/CRS804-4DDQ-hRM/g, "CRS326-24G-2S+");

    it("every parser accepts a matching row with a model supplied", () => {
      for (const parser of PARSERS) {
        expect(parser.parsePrice(MATCH_HTML, "CRS804-4DDQ-hRM")).not.toBeNull();
      }
    });

    it("every parser rejects a foreign row when a model is supplied", () => {
      for (const parser of PARSERS) {
        expect(parser.parsePrice(MISMATCH_HTML, "CRS804-4DDQ-hRM")).toBeNull();
      }
    });
  });
```

- [ ] **Step 2: Run the integration suite**

Run: `pnpm vitest run tests/scraping-integration.test.ts`
Expected: PASS — both new loops cover all 25 parsers.

- [ ] **Step 3: Full verification**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: tsc 0 errors; lint 0 errors (pre-existing warnings acceptable); all tests pass.

- [ ] **Step 4: Checkpoint commit**

```bash
git add tests/scraping-integration.test.ts
git commit -m "Checkpoint: v6.8: Parser model-number verification. TypeScript: 0 errors."
```

(If Steps 1-3 surfaced fixups anywhere else, include those files in the same commit.)

---

## Out of scope (per spec)

- No changes to site selectors, rate limits, browser escalation, or blocked detection.
- Separator characters remain weak boundaries (spec rule: only alphanumeric neighbors invalidate); `CRS804-4DDQ` still matches `CRS804-4DDQ-hRM`.
- Health classification semantics unchanged: a verified miss flows through the existing `null` path ("no price found").
