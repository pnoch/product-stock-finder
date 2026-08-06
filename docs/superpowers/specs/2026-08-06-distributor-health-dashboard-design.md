# Distributor Health Dashboard Design Spec

**Date:** 2026-08-06
**Status:** Approved
**Scope:** Add a dedicated Distributor Health Dashboard screen to both mobile (Expo) and desktop (Tauri) apps, showing scraper status per distributor with a live "Test All" capability.

## Overview

Add a new screen that shows the health of all 25 distributor scrapers. Each distributor displays its last-known status (working / blocked / error), reason, response time, and last-checked time. A "Test All" button runs a live test of all scrapers in parallel batches with a progress bar. Status persists between app launches via AsyncStorage.

## Architecture

### Shared Module: `lib/scrapers/health.ts`

A platform-agnostic module consumed by both mobile and desktop screens.

**Types:**
```typescript
export type HealthStatus = "working" | "blocked" | "error";

export interface DistributorHealth {
  distributorId: string;
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  lastChecked: string; // ISO timestamp
}
```

**Functions:**
- `testAllDistributors(onProgress?: (current: number, total: number) => void): Promise<DistributorHealth[]>`
  - Iterates all 25 parsers from `PARSERS` in batches of 3 (parallel)
  - For each: builds search URL, calls `fetchWithParser`, runs `parsePrice`
  - Classifies result, records response time
  - Calls `onProgress` after each distributor completes
- `classifyResult(html: string, result: ScrapeResult | null, error?: unknown): HealthStatus`
  - Pure function for classification logic (unit-testable)
- `getDistributorHealth(): Promise<DistributorHealth[]>`
  - Reads persisted health from AsyncStorage
- `saveDistributorHealth(health: DistributorHealth[]): Promise<void>`
  - Writes health to AsyncStorage

### Classification Logic

`classifyResult` determines status:
- **working** — parser returned a valid `ScrapeResult` with a price
- **blocked** — HTML contains "403 Forbidden", "Access Denied", "cf-browser-verification", or "Checking your browser"
- **error** — connection refused, timeout, SSL error, or no price found

### Storage

New AsyncStorage key: `distributor_health`. Stored as a JSON array of `DistributorHealth`.

The shared `health.ts` module uses the `StorageAdapter` pattern (via `createStorage`) so it works on both mobile (AsyncStorage) and desktop (localStorage). It reads the default storage instance.

### Screens

**Mobile:** `app/health.tsx` (Expo Router route)
**Desktop:** `desktop/src/pages/Health.tsx` (React Router route)

Both screens share the same structure:
- **Status summary** — counts of working / blocked / error
- **Filter chips** — All / Working / Blocked / Error
- **Distributor list** — name, status badge, reason, response time, last-checked
- **"Test All" button** — runs `testAllDistributors` with progress bar

### Background Integration

`background-price-check.ts` updates health status per distributor as it scrapes, so status stays fresh without manual tests. After each successful/failed scrape, it calls `saveDistributorHealth` with the updated entry.

## Data Flow

1. **Screen mount** — load persisted health via `getDistributorHealth()`, display last-known status
2. **"Test All" tap** — call `testAllDistributors(onProgress)`:
   - Iterate all 25 parsers in batches of 3 (parallel)
   - For each: build search URL, call `fetchWithParser`, run `parsePrice`
   - Classify result, record response time
   - Update progress bar
3. **On completion** — persist results via `saveDistributorHealth()`, refresh UI
4. **Background scrape** — `background-price-check.ts` updates health per distributor

## Error Handling

- Each parser test wrapped in try/catch — one failure doesn't abort the batch
- Network errors → `error` status with reason string
- 403/Cloudflare/Access Denied → `blocked` status
- No price found → `error` with "no price found" reason
- AsyncStorage read/write failures → silently fall back to empty state

## Testing

- Unit tests for `classifyResult` (mock HTML/result → working/blocked/error)
- Unit tests for persistence (save/load round-trip)
- Component tests for the health screen (renders statuses, filter works, Test All triggers)

## Files

**New:**
- `lib/scrapers/health.ts` — shared health module
- `app/health.tsx` — mobile screen
- `desktop/src/pages/Health.tsx` — desktop screen
- `tests/scrapers/health.test.ts` — unit tests for classification + persistence
- `desktop/tests/health.test.tsx` — component tests for desktop screen

**Modified:**
- `lib/background-price-check.ts` — update health status during scrape
- `desktop/src/App.tsx` — add Health route
- `desktop/src/components/` — shared UI components if needed
