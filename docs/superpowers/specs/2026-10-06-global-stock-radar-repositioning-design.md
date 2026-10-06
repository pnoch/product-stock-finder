# Global Stock & Price Radar — Repositioning + Landed-Cost Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Origin

The app began as a personal fix: during a global MikroTik CRS804 shortage, the
founder burned Manus AI credits trying to locate stock, then found one at Getic
(Latvia) with FedEx delivery to Thailand via a ChatGPT recommendation. The
product is the automation of that exact moment — *find who has this hard-to-find
part worldwide, what it costs landed at my door, and tell me the second it
restocks or drops.*

## Positioning

**"Global stock & price radar for hard-to-find hardware."**

Not a price tracker. A **scarcity radar**: availability-first, with landed cost
to the user's country as the ranking signal. The origin story is the marketing.

## The Core Promise

**"Find who has it worldwide, at the best landed price, and get told the second
it restocks or drops."**

The unifying concept is **landed cost** — `price + shipping(dest) + duty/VAT(dest)`,
converted to the user's currency, delivered to *their* country. Availability says
*if* you can buy; landed cost says *whether it's worth it*. This is what makes
"both availability and price" coherent rather than two products.

## Why This Beats ChatGPT

ChatGPT is a **snapshot**: one search, one page, no memory, no reliability.
This app is a **monitor**: continuous watching, restock/price alerts, a
watchlist, systematic 25-store comparison, structured price/stock, and price
history. The wedge is the moment a user cares about a part *over time* — which
a shortage forces — where ChatGPT structurally cannot help.

## Audience

People who hit shortages and cannot afford to miss a restock:

- Homelabbers hunting Raspberry Pi / NAS / server parts
- Network engineers sourcing switches/routers during lead-time crunches
- Small IT shops and resellers who lose money when a part is unavailable
- Enthusiasts chasing scarce gear

Beachhead: **homelab / SBC / networking**. Expand category by category (SBC →
NAS/storage → networking → servers → GPUs → 3D printing) as catalog + parsers,
not a rewrite.

## Hero Flow (the magic moment)

1. **Paste a model number or URL** (or search the catalog).
2. App fans out across all 25 global distributors.
3. Results ranked by **landed cost to the user's country**:
   "Getic (Latvia) — $209 + $38 FedEx = **$247 to Thailand**."
4. A **filter bar** (ship-to country + tax-exempt toggle) re-ranks the same
   results instantly — "what if I ship to Singapore?" / "I'm VAT-exempt."
5. **"Watch this"** → restock + price-drop alerts, forever.
6. Optional: bulk-paste 20 models for a whole build.

## What Exists vs. What's New

| Capability | Status |
| --- | --- |
| 25 global distributors, 25 parsers | Built |
| Currency conversion (10 currencies) | Built |
| Shipping cost per **region** | Built (needs per-country) |
| Tax rates per country | Built (needs import duty) |
| `findBestDeal` landed-cost ranking | Built |
| Restock watches + price alerts | Built |
| Paste-model → discover across all stores | Built |
| **Destination-country landed cost** | New |
| **Import duty / VAT estimate** | New |
| **"Ship to" onboarding + currency** | New |
| **Repositioned copy / hero screen** | New |
| **Billing (RevenueCat) + release signing + telemetry** | New |

The engine is done. This is positioning + UX + a landed-cost upgrade.

## Architecture

### 1. Destination profile — `lib/destination.ts` (new)

A user's shipping destination and tax status:
`{ countryCode, currency, taxExempt }`, persisted in `AppSettings`
(`shipToCountry`, `displayCurrency` already exists; add `taxExempt`). Defaults:
country from device locale, currency from country, `taxExempt: false`. Onboarding
asks "Where do you ship to?" once.

**Tax exemption.** When `taxExempt` is true (a business/reseller with a VAT/EORI
number, or a jurisdiction where the import is duty-free), `computeLandedCost`
omits the duty and VAT components, so the ranking reflects the true cost the
buyer pays. The exemption is a user-declared setting, not verified — the UI
labels the result "tax-exempt estimate" so it is never mistaken for a firm quote.

### 1a. Destination + tax filters — results screen

The destination is not only an onboarding default: the hero results screen
exposes it as a **live filter bar** so a user can answer "what if I ship to X?"
without leaving the results:

- **Ship-to country** — a picker (searchable, ~200 countries) that re-ranks the
  same results by landed cost to the selected country. Changing it updates the
  breakdown in place; no re-scrape is needed (only the cost math changes).
- **Tax exempt** — a toggle next to the country picker that includes/excludes
  duty + VAT in every row and in the ranking.
- Both persist back to `AppSettings` as the new default for the next visit.

This is a pure presentation-layer re-rank over already-fetched listings, so it is
instant and offline-safe.

### 2. Per-country shipping — `shared/src/distributors.ts`

Extend each distributor's `shippingCosts` from region keys to **country keys**
with the region as fallback:

```ts
shippingCosts: {
  TH: 38, SG: 30, MY: 15,          // explicit per-country
  "Asia-Pacific": 15, Europe: 40,   // region fallback
  ...
}
```

`resolveShipping(distributor, countryCode)` → explicit country → region → null.
The existing region table remains the fallback, so nothing breaks for countries
without explicit data.

### 3. Import duty + VAT estimate — `lib/landed-cost.ts` (new)

`estimateDuty(price, category, countryCode)` using a curated table
(`shared/src/duty.ts`): destination VAT/GST rate + a coarse duty rate by product
category. Clearly labelled an **estimate**; accuracy is not the goal, ranking is.

### 4. Landed cost — `lib/landed-cost.ts`

`computeLandedCost(listing, distributor, destination)` →
`{ price, shipping, duty, vat, total, currency, isEstimate }`, all converted to
the destination currency. When `destination.taxExempt` is true, `duty` and `vat`
are `0` and the result is flagged tax-exempt. Extends the existing `findBestDeal`
rather than replacing it (keep `findBestDeal` for the region-level path).

### 5. Hero screen — `app/search.tsx` + `app/product/[id].tsx`

The paste-model flow already exists (`ManualAddSheet` → `discoverListings`).
Change the results presentation to rank by landed cost and show the
breakdown; add the **ship-to country + tax-exempt filter bar** and a prominent
"Watch this" CTA.

## Data Flow

1. Onboarding sets `shipToCountry` + `displayCurrency` + `taxExempt`.
2. Paste model → `discoverListings` across all parsers (server-first, device
   fallback).
3. `computeLandedCost` per hit → sort ascending → render.
4. Filter bar changes (country, tax-exempt) → re-run `computeLandedCost` over the
   already-fetched listings → re-sort → render (no network).
5. "Watch this" → existing `addToWatchlist` + restock/price alert.

## Error Handling

- Missing shipping/duty data → fall back to region, then to `null` (show
  "shipping unknown" rather than a wrong number).
- Every estimate is labelled; never present an estimate as a firm quote.
- Existing scrape failure handling is unchanged (breaker, provider fallback).

## Monetization

**Freemium, server-backed:**
- **Free** — standalone, limited distributors, manual checks.
- **Pro** (~$4–6/mo) — all 25 distributors, continuous restock/price monitoring,
  digests, sync, landed-cost sourcing, bulk watch.

The shared price cache amortizes server cost across users, so margins work.
Billing via RevenueCat (Play Billing + entitlements).

## Scope of the First Revision

This spec covers the **repositioning + landed-cost core**. It is large; the
implementation plan should sequence it as:

1. Destination profile + onboarding ("Where do you ship to?" + tax-exempt).
2. Per-country shipping + duty estimate + `computeLandedCost`.
3. Hero results ranked by landed cost + **ship-to/tax-exempt filter bar** +
   "Watch this" CTA.
4. Repositioned copy (name, onboarding, store listing).
5. Catalog expansion beyond MikroTik.

**Out of scope for this revision:** billing, release signing, telemetry, and
catalog expansion are separate follow-on specs (they are prerequisites for
*charging*, not for the repositioning itself).

## Testing

- `lib/landed-cost` unit tests: country→region fallback, missing data → null,
  currency conversion, estimate labelling, **tax-exempt zeroes duty+VAT**.
- `resolveShipping` tests across explicit/region/absent cases.
- Hero ranking test: results sorted by landed cost, not raw price.
- Filter test: changing ship-to country / tax-exempt re-ranks without a network
  call and persists to `AppSettings`.
- Existing `findBestDeal` tests stay green (unchanged path).

## Success Criteria

- A user in Thailand pastes `CRS804-4DDQ-hRM` and sees distributors ranked by
  landed cost to Thailand, with a shipping/duty breakdown and a "Watch this" CTA.
- The ship-to country picker and tax-exempt toggle re-rank the results instantly
  and persist as the new default.
- Countries without explicit shipping data fall back to the region estimate.
- `pnpm verify` stays green.

## Risks

- **Shipping/duty data accuracy** → labelled estimates; ranking is the value,
  not precision. Start curated, refine with real user feedback.
- **Scope creep into billing** → explicitly deferred to a follow-on spec.
- **Repositioning without catalog breadth** → the beachhead (homelab/SBC) is
  added in step 5; until then the app is "MikroTik + paste anything."
