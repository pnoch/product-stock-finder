# Rates Live-FX Parity Fix — Design

Date: 2026-09-06. Scope: mobile/desktop Rates parity (approved: parity fix).

## Finding

Both Rates screens already display live persisted FX rates
(`FxHistory.rates` from storage) with static `EXCHANGE_RATES` fallback,
and both support manual refresh (`refreshFxRates` via pull-to-refresh /
Refresh button). The only gaps:

1. `app/(tabs)/rates.tsx` never auto-refreshes stale rates on mount;
   `desktop/src/pages/Rates.tsx` does (`maybeRefreshFxRates`, TTL 1h +
   deterministic jitter, silent failure).
2. `app/(tabs)/rates.tsx` still imports `EXCHANGE_RATES` from
   `@/lib/currency`; per the currency migration it must come from
   `@shared/currency` (pure static fallback — no live behavior involved).

## Change

`app/(tabs)/rates.tsx` only (plus one guard-test assertion):

- Import `maybeRefreshFxRates` from `@/lib/fx` alongside `refreshFxRates`.
- On mount, mirror desktop exactly (`desktop/src/pages/Rates.tsx:62-65`):
```tsx
useEffect(() => {
  void maybeRefreshFxRates().catch(() => {});
  void loadData();
}, [loadData]);
```
  Errors swallowed so the screen always renders cached history
  immediately. No reload-after-refresh: identical to desktop behavior;
  next mount or pull-to-refresh picks up fresh data.
- Swap `import { EXCHANGE_RATES } from "@/lib/currency"` to
  `"@shared/currency"`.
- Guard test (style of `tests/shared-desktop-criticals.test.ts`):
  assert `app/(tabs)/rates.tsx` source contains `maybeRefreshFxRates`
  and contains no `@/lib/currency` import.

## Non-goals

- No `useFocusEffect` / refresh-on-focus (rejected: new pattern, extra
  server churn for tab-hopping).
- No changes to TTL, jitter, `refreshFxRates`, `FxRateGrid`,
  `appendFxHistory`, or desktop code.
- No UX copy changes; error/silent-failure semantics unchanged.

## Verification

`pnpm check` (0 errors), `pnpm lint` (no new warnings), `pnpm test`
(full suite green).
