# Enhanced Weekly Digest — Design Spec

**Date:** 2026-09-10
**Goal:** Enrich the digest computation (value delta, new/removed products, biggest-mover sorting), surface a full in-app digest card on the Stats screen, and make the push notification lead with the most important changes.

## Current State

`lib/price-digest.ts` computes priceChanges/stockChanges/alertTargetsHit vs the stored snapshot; `formatDigestNotification` truncates to 6 lines; `maybeSendDigest` sends daily/weekly per `settings.digestFrequency` and overwrites the snapshot. No in-app digest view exists.

## Extended Computation (lib/price-digest.ts)

`DigestResult` additions:
```typescript
valueDelta: { from: number; to: number; percent: number } | null;
newProducts: { productId: string; name: string }[];
removedProducts: { productId: string; name: string }[];
```
- `valueDelta`: previous totalValue → current totalValue (null when either side has no prices).
- new/removed: set difference on productId between snapshots.
- `priceChanges` sorted by |percent| descending.

`formatDigestNotification` rewrite:
1. Value line: "Watchlist value $X → $Y (+Z%)" then stock counts.
2. Biggest mover first, then up to 2 more changes.
3. Up to 2 stock changes, 2 targets hit, 1 line "N products added" / "M removed".
4. Cap ~9 lines total; unchanged "No changes…" fallback.

## In-App Digest Card

`components/stats/digest-card.tsx` — props `{ result: DigestResult | null; periodLabel: string }`:
- Title "Digest — {periodLabel}" ("this week"/"today"/"off" from settings.digestFrequency)
- Sections rendered only when non-empty:
  - Value delta header (from → to with %)
  - Price changes list (all rows: name, from→to, ±%)
  - Stock transitions
  - 🎯 Targets hit
  - Added / removed product lines
- Null result or empty watchlist → not rendered.

## Wiring (app/stats.tsx)

Load snapshot via existing storage export `getPriceDigestSnapshot`; compute `digest = useMemo(() => snapshot ? computeDigest(snapshot, watchlist, displayCurrency, alerts?) : null)`. Note: `computeDigest` signature takes `(previous, watchlist, settings, alerts)` — pass loaded settings; render `<DigestCard>` above MoversCard.

periodLabel map: weekly→"this week", daily→"today", off→hidden (card hidden when frequency is off).

## Testing

Extend `tests/price-digest.test.ts`:
- valueDelta computed across snapshots (and null when no previous)
- newProducts/removedProducts detection
- priceChanges sorted biggest-mover-first
- formatDigestNotification leads with value delta + biggest mover

Existing tests updated only where output ordering changed intentionally.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/price-digest.ts` | extend |
| `tests/price-digest.test.ts` | extend |
| `components/stats/digest-card.tsx` | new (~130 lines) |
| `app/stats.tsx` | modify (snapshot load + card) |
| `todo.md` | append Phase 94 |
