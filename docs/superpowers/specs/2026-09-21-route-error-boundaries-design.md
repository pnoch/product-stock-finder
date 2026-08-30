# Route-Level Error Boundaries

**Date:** 2026-09-21
**Status:** Approved

## Problem

A single `AppErrorBoundary` wraps the entire app. Any crash in any screen (product detail, compare, search, etc.) shows a full-screen error and kills the whole app. Users lose their place and must navigate back from the home screen.

## Solution

Create a reusable `RouteErrorBoundary` component and export it from the 5 highest-risk route files. Expo Router natively supports `export { ErrorBoundary }` from route files — when a route exports one, it catches errors within that route's tree without affecting the parent or other routes.

## Changes

### New: `components/route-error-boundary.tsx`

- Class component extending `React.Component`
- Catches errors, shows route-specific fallback UI
- "Try Again" button resets the boundary state
- "Go Back" button calls `router.back()` (navigates to previous screen, not home)
- Logs error to console and AsyncStorage (same as AppErrorBoundary)

### Modified: Route files (5 high-risk routes)

Each file gets one line added at the bottom:

```typescript
export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
```

Files:
- `app/product/[id].tsx` — 1187 lines, most complex screen
- `app/compare/[id].tsx` — 289 lines, chart + data processing
- `app/search.tsx` — 307 lines, search + multiple modals
- `app/(tabs)/settings.tsx` — settings + account management
- `app/(tabs)/alerts.tsx` — alerts + reminders

## What stays the same

- Top-level `AppErrorBoundary` in `app/_layout.tsx` remains as the final catch-all
- Routes without explicit `ErrorBoundary` (home, watchlist, stats, etc.) still fall through to the top-level boundary

## Testing

- `pnpm check` — 0 errors
- `pnpm lint` — 0 errors
- Existing `tests/app-error-boundary.test.tsx` still passes
- Manual: product detail crash → shows "Go Back" instead of full app crash
