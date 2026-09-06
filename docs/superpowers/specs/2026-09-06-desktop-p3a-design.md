# Desktop P3a: Compare Alert CTA + Browser Price Insight — Design

Date: 2026-09-06. Scope: sub-project P3a — price-intelligence parity
(approved).

## Problem

1. Mobile Compare has a cross-distributor alert CTA
   (`CrossAlertCTA`); desktop `Compare.tsx` has no alert creation —
   users who spot a trend can't act on it.
2. Desktop `ProductDetail.tsx:153` returns early outside Tauri, so
   browser users never get the AI price insight mobile loads via
   `fetchPriceInsight` — even though `insights.get` is a
   `publicProcedure` (`server/routers.ts:221`) callable directly.

## Approach

Sentinel alert creation (approved over navigate-to-prefill: same
one-click flow as mobile, no new infra). Insight keeps the Tauri
invoke path and adds a vanilla-client fallback (direct fetch may fail
under Tauri CORS, hence the proxy — so the Tauri path stays).

## Compare CTA

- `desktop/src/pages/Compare.tsx`: card near the prices table —
  "Alert me below $X" (X = 5% below best in-stock converted price,
  same copy/math as mobile `CrossAlertCTA`).
- On click: filter in-stock listings, convert via `convertPrice`
  (already imported in the file), take min; no in-stock or
  unconvertible → toast ("No in-stock distributors" /
  conversion-unavailable copy, mirroring mobile).
- Create sentinel alert via `storage.addAlert`: id
  `cross-${productId}-${Date.now()}-...`, `distributorId: undefined`,
  target 95% rounded to 2dp, display currency, `isActive: true`;
  toast "Alert set below $X".
- No permission request, no local schedule (desktop has no
  notification-permission flow; the Check-Now/background pipeline
  evaluates alerts).

## Insight fallback

- `desktop/src/pages/ProductDetail.tsx`: replace the bare
  `if (!("__TAURI__" in window)) return;` with a browser branch — if
  `getApiBaseUrl()` is set, query `insights.get` via vanilla
  `createTRPCClient` (`../lib/trpc`) with a 4s timeout race (mirroring
  `lib/server-insights.ts`), `setInsight` on success, silent catch.
- Tauri invoke path byte-identical. Do NOT import
  `lib/server-insights` (pulls the expo tRPC chain into the desktop
  bundle); inline the ~10-line fetch.

## Testing

- Source-guard tests: Compare creates `cross-` sentinel alert via
  `addAlert`; ProductDetail references `insights.get` outside the
  Tauri gate.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Permission flow, local notification scheduling, insight caching.
- Mobile/server changes; remaining P3b/P3c gaps untouched.
