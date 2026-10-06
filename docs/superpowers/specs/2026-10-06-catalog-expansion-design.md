# Catalog Expansion (Homelab / SBC Beachhead) — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Grow the product catalog from 42 to ~140 **real** products across the homelab /
SBC / NAS / networking beachhead, so the repositioned copy ("hard-to-find
hardware", "find it anywhere") is backed by breadth a homelabber can actually
search.

## Problem

The catalog is 42 items, 10 of them MikroTik. A user hunting a Raspberry Pi 5, a
Synology NAS, or a UniFi AP finds almost nothing. The repositioning (Phase 1117)
promises breadth the catalog does not deliver.

## Scope

**In scope:** ~100 new catalog entries (`shared/src/catalog.ts`), a few homelab
items in the trending fallback (`shared/src/trending.ts`), and a guard test.

**Out of scope:** category-browse UI (search already fuzzy-matches category);
per-product listings (discovered at runtime); billing.

## What to Add (~100 real products)

Curated, **real** products with correct model numbers, across the beachhead
categories. No fabrication — every entry is well-known gear.

| Category | Examples |
| --- | --- |
| Single-Board Computer | Raspberry Pi 5 (4/8/16GB), Pi 4, Pi Zero 2 W, CM4, Orange Pi 5, Radxa Rock 5B, BeagleBone Black |
| Storage | Synology DS923+/DS224+/DS1522+, QNAP TS-464, TerraMaster F4-423, WD Red Plus drives |
| Networking Switch | MikroTik CRS310/CRS328, Ubiquiti USW-Flex/Pro-24, TP-Link Omada, Aruba Instant On |
| Network Gateway | UniFi UDM-SE, UDR, Cloud Gateway Ultra, TP-Link ER605 |
| Wireless Bridge | UniFi U7 Pro, U6+, U6-Lite, TP-Link EAP610 |
| Network Card | Intel X520/X710, Mellanox ConnectX-4/5, 2.5G/10G NICs |
| Desktop | Intel NUC, Minisforum, Beelink, ASRock mini-ITX (mini-PCs) |
| UPS | APC Back-UPS, CyberPower |
| Cooling | Noctua fans, thermal paste |

### Entry shape (unchanged)

```ts
{
  id: "raspberry-pi-5-8gb",
  name: "Raspberry Pi 5 (8GB)",
  modelNumber: "SC1112",
  brand: "Raspberry Pi",
  category: "Single-Board Computer",
  description: "…",
}
```

`id` is a stable slug (`brand-model`); `modelNumber` is the real part number.
**`category` MUST be one of the 17 categories already in the catalog** (a guard
test enforces this). This keeps the duty table unchanged: the five ITA-zero-rated
categories (Networking Switch, Single-Board Computer, Network Card, Network
Gateway, Wireless Bridge) stay 0%, and the rest keep their existing treatment.
Do NOT invent a new category (e.g. "Server") — use `Desktop` for mini-PCs.

### Trending fallback — `shared/src/trending.ts`

Add ~3 homelab items (e.g. Raspberry Pi 5, a Synology NAS, a UniFi AP) so the
empty-state "Try:" hint and the trending section reflect the audience. Keep the
existing entries.

## Data Flow

None — static data. `searchCatalog` (Fuse.js) already indexes name/model/brand/
category, so new entries are searchable immediately. `getAllCategories` /
`getAllBrands` derive from the catalog.

## Error Handling

None.

## Testing

- Extend `tests/catalog.test.ts` (or add `tests/catalog-expansion.test.ts`):
  - every entry has a unique `id`, non-empty `name`/`modelNumber`/`brand`/
    `category`/`description`;
  - `id` is a lowercase slug (`/^[a-z0-9-]+$/`);
  - every `category` is one of the 17 existing catalog categories;
  - a minimum count per beachhead category (e.g. ≥5 Single-Board Computer, ≥4
    Storage, ≥6 Networking Switch, ≥3 Network Gateway, ≥3 Wireless Bridge, ≥3
    Network Card, ≥3 Desktop);
  - total catalog ≥ 120;
  - `searchCatalog` finds a sample of new products by model and by brand.
- Existing catalog tests stay green.

## Success Criteria

- The catalog has ≥120 real products spanning the beachhead categories.
- A search for "Raspberry Pi 5", "Synology", "UniFi U7", "ConnectX" returns
  results.
- Every category maps to a duty rate (no `default` 5% for beachhead gear).
- `pnpm verify` stays green.

## Risks

- **Fabricated/incorrect model numbers** → mitigated by using only well-known
  gear and a guard that requires real-looking fields; I cannot verify live
  availability (that is the scraper's runtime job).
- **Category drift** → the guard pins categories to the duty set.
