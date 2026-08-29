# Design: Multi-Currency Display + Exchange Rate Sparkline Grid

## Overview

Two connected features:
1. **Multi-currency display** — the app already converts prices to the user's selected `displayCurrency`. This adds a visible exchange rate indicator next to converted prices.
2. **New "Rates" tab** — a sparkline grid showing all supported currencies vs USD with current rate, % change from previous fetch, and a mini sparkline chart.

## Architecture

### FX Rate History Storage

New AsyncStorage key `fx_rate_history` storing:
```ts
{
  rates: Record<string, number[]>;  // currency code → array of rates (oldest first)
  timestamps: number[];             // epoch ms of each fetch
}
```

- Capped at 90 data points (oldest dropped on append)
- Hourly fetches → ~90 days of history
- Appended on each successful `refreshFxRates()` call

### New Files

| File | Purpose |
|------|---------|
| `lib/fx-history.ts` | `appendFxHistory`, `getFxHistory`, `getFxChange` helpers |
| `lib/storage/fx-history.ts` | AsyncStorage CRUD for `fx_rate_history` |
| `app/(tabs)/rates.tsx` | New Rates tab screen |
| `components/rates/fx-sparkline-card.tsx` | Single currency card with sparkline |
| `components/rates/fx-rate-grid.tsx` | Grid layout for all currency cards |

### Modified Files

| File | Change |
|------|--------|
| `lib/fx.ts` | Call `appendFxHistory()` after successful rate fetch |
| `app/(tabs)/_layout.tsx` | Add "Rates" tab between Alerts and Settings |
| `app/product/[id].tsx` | Show rate subtitle on converted price |
| `components/best-distributor-card.tsx` | Show rate subtitle on converted price |

## Data Flow

```
App launch → maybeRefreshFxRates()
  → fetchFxRates() from open.er-api.com
  → save to storage (existing)
  → appendFxHistory() (new)
  → setExchangeRates() (existing)

Rates tab → getFxHistory() from storage
  → compute % change per currency
  → render grid of sparkline cards
```

## Rates Tab Screen

### Layout
- Header: "Exchange Rates" + "Last updated: Xh ago"
- Grid: 2 columns (mobile), 3 columns (tablet+)
- Each cell: `FxSparklineCard`

### FxSparklineCard
- Currency flag emoji + code (e.g., "🇪🇺 EUR")
- Current rate vs USD (e.g., "1.0872")
- % change from previous data point (green ↑ / red ↓)
- Mini SVG sparkline (polyline, 60×24 viewport)
- Subtle background color on hover/tap

### Currencies shown
Same 12 as `EXCHANGE_RATES`: USD, EUR, GBP, MYR, AUD, NZD, CAD, ZAR, THB, SGD, HKD, AED

## Price Display Enhancement

On product detail and best-deal cards, when a price is converted from another currency, show a muted subtitle:
```
1 EUR = 1.087 USD
```
Only shown when `displayCurrency !== listing.currency`.

## Error Handling

- If FX history fetch fails silently (existing behavior), no history data point is added
- If history storage is corrupted, return empty array (graceful degradation)
- Sparkline renders "—" if < 2 data points

## Testing

- Unit tests for `lib/fx-history.ts` (append, cap, change calculation)
- Unit test for `FxSparklineCard` rendering with various data states
- Integration test for Rates tab rendering
