# Trending Hard-to-Find Products — Design Spec

**Date:** 2026-08-29
**Author:** AI Agent
**Status:** Approved

## Overview

Add a "Trending Now" section to the home screen that surfaces hard-to-find products from external sources (Reddit, HN, Slickdeals, tech news, enterprise supply trackers). Server aggregates and caches trending products; client fetches the cached list on app open.

## Goals

1. Proactively suggest products that are hard to source, beyond the static 45-product catalog
2. Surface enterprise/hardware products (DGX Spark, H100, etc.) alongside consumer gear
3. Keep client fast — no LLM calls on app open, only cached data

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ RSS Feeds   │───▶│ Server Cron  │───▶│ trendingProducts │
│ (8 sources) │    │ (every 6h)   │    │ table (cached)  │
└─────────────┘    └──────────────┘    └────────┬────────┘
                                                │
                                         GET /api/trending
                                                │
                                         ┌──────▼──────┐
                                         │ Client      │
                                         │ (on app open)│
                                         └─────────────┘
```

### Server Side

**RSS Sources (8 feeds):**

| Source | URL | Signal |
|--------|-----|--------|
| r/buildapcsales | reddit.com/r/buildapcsales/.rss | GPU/CPU scarcity |
| r/hardwareswap | reddit.com/r/hardwareswap/.rss | Supply/demand from resale |
| Hacker News | hn.algolia.com/api/v1/search | Hardware launch discussions |
| Slickdeals | slickdeals.net/newsearch.php | Electronics stock alerts |
| NVIDIA product pages | nvidia.com/en-us/dgx/ | DGX Spark/H100/B200 |
| Raspberry Pi stock | rpilocator.com | SBC availability |
| Tom's Hardware | tomshardware.com/feed | Product launch scarcity |
| Anandtech | anandtech.com/rss | Hardware analysis |

**Server Cron Job (every 6 hours):**
1. Fetch all 8 RSS feeds
2. Parse product mentions (extract product names, brands, prices)
3. Send to LLM with prompt: "Given these trending products from tech communities, which are hardest to find or most in demand? Return top 10 with name, brand, category, estimated price (USD), and a 1-sentence scarcity reason. Exclude these products already in the user's watchlist: {watchlist}."
4. Store top 10 in `trendingProducts` table with `expiresAt = now + 6h`

**API Endpoint:**
- `GET /api/trending` → returns cached `TrendingProduct[]` where `expiresAt > now`
- No authentication required (public data)
- Returns up to 10 products

**Database Table:**
```sql
CREATE TABLE trendingProducts (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  category VARCHAR(100),
  estimatedPrice DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  reason TEXT,
  source VARCHAR(255),
  fetchedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP NOT NULL
);
```

### Client Side

**Data Flow:**
1. `app/_layout.tsx` calls `fetchTrending()` on app open (after auth check)
2. `lib/trending.ts` fetches from `GET /api/trending`
3. Response stored in React Query cache (`queryKey: ["trending"]`)
4. Home screen reads from React Query and renders `<TrendingSection />`

**API Client (`lib/trending.ts`):**
```typescript
export async function fetchTrending(): Promise<TrendingProduct[]> {
  const res = await fetch(`${getApiBase()}/api/trending`);
  if (!res.ok) return [];
  return res.json();
}
```

**Types (`lib/types.ts`):**
```typescript
export interface TrendingProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  estimatedPrice: number;
  currency: string;
  reason: string;
  source: string;
  fetchedAt: string;
  expiresAt: string;
}
```

## UI Design

### Home Screen — Trending Section

Located between the header and "Your Watchlist" section:

```
┌─────────────────────────────────┐
│ 🔥 Trending Now                 │
│ Hard-to-find products from      │
│ the community                   │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ NVIDIA DGX Spark            │ │
│ │ Server • NVIDIA • $3,000    │ │
│ │ 8 sold out in 24h           │ │
│ │ [Add to Watchlist]          │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ RTX 5090                    │ │
│ │ GPU • NVIDIA • $2,000       │ │
│ │ High demand, low supply     │ │
│ │ [Add to Watchlist]          │ │
│ └─────────────────────────────┘ │
│                See All →        │
└─────────────────────────────────┘
```

- **Cards:** Product name, brand, category, estimated price, scarcity reason
- **Add to Watchlist:** Adds to local watchlist + syncs to server
- **See All:** Links to full trending screen (stretch goal)
- **Loading state:** Skeleton cards
- **Empty state:** "No trending products right now. Check back later."

### Component: `TrendingSection`

**Props:** None (reads from React Query)

**Behavior:**
1. On mount, fetches trending products from React Query cache
2. Shows loading skeleton while fetching
3. Shows top 3 trending products as cards
4. Each card has "Add to Watchlist" button
5. If product already in watchlist, show "In Watchlist" instead

**Styling:**
- Uses `useColors()` for theme tokens
- Card background: `surface`
- Primary text: `foreground`
- Secondary text: `muted`
- "Add to Watchlist" button: `primary` background

## File Changes

| File | Change |
|------|--------|
| `server/routers/trending.ts` | **NEW** — API endpoint, RSS fetch, LLM analysis |
| `server/routers.ts` | Register trending router |
| `drizzle/0019_trending_products.sql` | **NEW** — trendingProducts table |
| `server/db.ts` | Add trendingProducts table reference |
| `lib/types.ts` | Add `TrendingProduct` interface |
| `lib/trending.ts` | **NEW** — client-side fetch function |
| `app/_layout.tsx` | Fetch trending on app open |
| `app/(tabs)/index.tsx` | Render `<TrendingSection />` |
| `components/home/trending-section.tsx` | **NEW** — trending cards UI |
| `tests/trending.test.ts` | **NEW** — client-side fetch tests |
| `tests/trending-server.test.ts` | **NEW** — server-side RSS + LLM tests |

## Edge Cases

1. **RSS feed down:** Skip that source, use remaining feeds
2. **LLM returns 0 products:** Return empty list, show empty state
3. **Product already in watchlist:** Show "In Watchlist" badge, no add button
4. **Stale data:** If `expiresAt < now`, server returns empty (client shows "Check back later")
5. **Network error:** Silent fail, show "Check back later" empty state
6. **No RSS feeds reachable:** Use fallback static list of known hard-to-find products

## Testing

- **Client:** `fetchTrending()` returns mocked data, handles errors gracefully
- **Server:** RSS parsing extracts product mentions, LLM prompt includes watchlist exclusion
- **Integration:** Full flow from RSS → LLM → cache → client display
