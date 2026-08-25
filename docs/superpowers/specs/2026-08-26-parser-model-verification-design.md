# Parser Model-Number Verification

Close audit finding #12. Every distributor parser builds a search URL from a model
number, fetches the results page, and prices whatever element its selector finds
first — without ever seeing the requested model. A fuzzy match, partial SKU, or
accessory on a search page gets its price and stock recorded under the wrong model,
then written into server cache, server price history, and client price history.
`parsePrice(html)` has no way to know what it should be looking at
(`lib/scrapers/types.ts:16`).

## Decisions

- **Treat mismatch as a miss.** When the priced element does not correspond to the
  requested model, the parser returns `null` — the same path as "price not found".
  Server-side, `refreshPrice` skips the cache/history write; client-side,
  `refreshListing` records its existing "no price found" error. No new plumbing.
- **Verify at the parser.** Only the parser knows which element it priced. A raw
  HTML pre-check is useless: search pages contain many models, so string presence
  anywhere proves nothing about the priced row.
- **Boundary-aware matching, not substring.** `RB5009` must reject
  `RB5009UG+S+IN` (a different SKU) while `CRS804-4DDQ-hRM` must match inside
  longer titles.

## Shared helpers — `lib/scrapers/utils.ts`

### `matchesModel(text: string, model: string): boolean`

Builds a case-insensitive regex from the model: alphanumeric characters become
escaped literals; each non-alphanumeric character becomes the lazy quantifier
`[^a-z0-9]*?`, so separators (`-`, `+`, `/`, spaces, punctuation) are flexible in
the target text without swallowing boundary characters (greedy separators would
eat a trailing space and break the boundary check on titles like
`crs326 24g 2s plus`). Scans every match; accepts only one whose neighboring
characters in the original text are non-alphanumeric (string start/end count as
boundaries). No lookbehind assertions — Hermes-safe. Returns `false` for empty
inputs or regex construction failures.

Examples:

| Model            | Text                              | Result |
| ---------------- | --------------------------------- | ------ |
| `CRS804-4DDQ-hRM`| `MikroTik CRS804-4DDQ-hRM RouterOS7` | match |
| `RB5009`         | `RB5009UG+S+IN`                    | no match |
| `hEX S`          | `hEX-S (RouterOS L4)`              | match |
| `CRS326-24G-2S+` | `crs326 24g 2s plus switch`        | match |

### `productRowContext($, $el): { text: string; href: string }`

Climbs from the priced element via cheerio `closest("tr, article, .product,
.product-item, .item, .product-card, li")`, falling back to the element itself.
Returns the container's text and its first `a[href]`.

## Parser contract change

`DistributorParser.parsePrice` becomes `(html: string, model?: string) =>
ScrapeResult | null`. Each parser's internal `parseHtml(html, url, model?)`:

1. Picks the price element exactly as today (site selectors unchanged).
2. Calls `productRowContext` on that element.
3. If `model` was provided and neither context `text` nor `href` satisfies
   `matchesModel`, returns `null`.
4. Without a model, behaves exactly as today (back-compat for tests/tools).

If the extracted container text is empty after trimming and the href is empty,
the parser accepts rather than rejects, so sites with unusual markup keep working.

All 24 parsers in `lib/scrapers/registry.ts` are updated mechanically; per-site
selection logic does not change. Per-parser `scrapeXxx(model)` helpers pass their
model through to `parseHtml`.

## Call sites

- `server/prices.ts` `refreshPrice`: `parser.parsePrice(outcome.html, modelNumber)`.
- `lib/background-tasks/refresh-listing.ts`: `parser.parsePrice(outcome.html,
  product.modelNumber)`.

Both already have the model in scope; no signature changes upstream.

## Error handling

- Mismatch → `null` → existing miss semantics everywhere (no cache write, no
  history point, health records "no price found" on the client path).
- Matcher never throws on odd input; malformed models simply fail to match.

## Testing

- New `tests/scrapers/utils.test.ts`: matcher matrix from the table above,
  empty/malformed inputs, multiple-candidate text where only the second
  candidate sits on boundaries; extractor container-climbing behavior.
- Each of the 24 scraper test files gains two cases: the matching fixture still
  parses; a fixture whose priced row names a different model returns `null`.
- `tests/scraping-integration.test.ts` updated for the new `parsePrice` signature.
