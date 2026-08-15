# End-to-End Live Mode v4.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make backend connectivity explicit (three-state Home badge + Settings Connection card) and render live server prices on product detail, compare, and watchlist screens via React Query, with AsyncStorage as the persisted seed/fallback.

**Architecture:** A new pure helper layer (`lib/live-prices.ts`, `lib/health.ts`) plus two React Query hooks (`hooks/use-live-prices.ts`, `hooks/use-connection.ts`) sit between AsyncStorage (persisted source of truth, unchanged) and the screens. Screens render `useLiveProduct`/`useLiveWatchlist` results — seed listings merged with server snapshots via `applyServerPrice` — and persist merged listings back on success. Connection state derives from a `/api/health` probe + `useAuth`. This is the app's first real `useQuery` consumer; `QueryClientProvider`/`trpc.Provider` already exist in `app/_layout.tsx:174-187,249-250`.

**Tech Stack:** React Query v5 (`@tanstack/react-query` ^5.90), Expo Router 6, NativeWind + inline styles, vitest 2 + `@testing-library/react` (new devDeps), `@testing-library/dom`, `jsdom`.

**Spec:** `docs/superpowers/specs/2026-08-15-end-to-end-live-mode-v4.5-design.md`

---

### Task 1: Add React testing devDependencies

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install devDependencies**

Run:
```bash
pnpm add -D @testing-library/react @testing-library/dom jsdom
```
Expected: packages added to `devDependencies`. Verify with:
```bash
pnpm ls -D @testing-library/react @testing-library/dom jsdom
```

- [ ] **Step 2: Verify current gates still pass**

Run: `pnpm check && pnpm test`
Expected: TypeScript 0 errors; all 570 tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(test): add @testing-library/react, @testing-library/dom, jsdom"
```

---

### Task 2: Pure live-price + connection helpers

**Files:**
- Create: `lib/live-prices.ts`
- Create: `lib/health.ts`
- Test: `tests/live-prices.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/live-prices.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl } from "../constants/oauth";
import { checkHealth } from "../lib/health";
import {
  applyServerPrice,
  composeLiveListings,
  deriveConnectionStatus,
  deriveListingQueries,
  mergeSampleHistory,
} from "../lib/live-prices";
import type {
  DistributorListing,
  PricePoint,
  ServerPriceResult,
} from "../lib/types";

vi.mock("../constants/oauth", () => ({
  getApiBaseUrl: vi.fn(),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

function listing(overrides: Partial<DistributorListing> = {}): DistributorListing {
  return {
    distributorId: "dist-1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "out_of_stock",
    url: "https://example.com",
    lastChecked: "2026-08-01T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  };
}

function point(date: string, price: number): PricePoint {
  return { date, price, currency: "USD", stockStatus: "in_stock" };
}

function serverResult(overrides: Partial<ServerPriceResult> = {}): ServerPriceResult {
  return {
    snapshot: {
      price: 90,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    },
    history: [],
    ...overrides,
  };
}

describe("deriveConnectionStatus", () => {
  it("is connected when reachable and authenticated", () => {
    expect(
      deriveConnectionStatus({ reachable: true, isAuthenticated: true }),
    ).toBe("connected");
  });

  it("is signed-out when reachable but not authenticated", () => {
    expect(
      deriveConnectionStatus({ reachable: true, isAuthenticated: false }),
    ).toBe("signed-out");
  });

  it("is offline when not reachable regardless of auth", () => {
    expect(
      deriveConnectionStatus({ reachable: false, isAuthenticated: true }),
    ).toBe("offline");
    expect(
      deriveConnectionStatus({ reachable: false, isAuthenticated: false }),
    ).toBe("offline");
  });
});

describe("checkHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true on 2xx", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("https://api.example.com");
    mockFetch.mockResolvedValue({ ok: true });
    await expect(checkHealth()).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/api/health");
  });

  it("returns false on non-2xx", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("https://api.example.com");
    mockFetch.mockResolvedValue({ ok: false });
    await expect(checkHealth()).resolves.toBe(false);
  });

  it("returns false on network error", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("https://api.example.com");
    mockFetch.mockRejectedValue(new Error("network down"));
    await expect(checkHealth()).resolves.toBe(false);
  });

  it("returns false when base URL is empty", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("");
    await expect(checkHealth()).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("applyServerPrice", () => {
  it("returns the listing unchanged when serverResult is null", () => {
    const l = listing();
    expect(applyServerPrice(l, null)).toBe(l);
  });

  it("overrides price, stock, url and lastChecked from the snapshot", () => {
    const l = listing();
    const result = applyServerPrice(l, serverResult());
    expect(result.price).toBe(90);
    expect(result.stockStatus).toBe("in_stock");
    expect(result.url).toBe("https://example.com");
    expect(result.lastChecked).not.toBe(l.lastChecked);
  });

  it("appends the snapshot point to the merged history", () => {
    const l = listing({
      priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
    });
    const result = applyServerPrice(l, serverResult({ history: [] }));
    expect(result.priceHistory).toHaveLength(2);
    expect(result.priceHistory[1].price).toBe(90);
    expect(result.priceHistory[1].stockStatus).toBe("in_stock");
  });

  it("merges server history when the snapshot is absent", () => {
    const l = listing({
      priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
    });
    const result = applyServerPrice(
      l,
      serverResult({
        snapshot: null,
        history: [point("2026-08-11T09:00:00.000Z", 95)],
      }),
    );
    expect(result.priceHistory).toHaveLength(2);
    expect(result.price).toBe(100);
    expect(result.stockStatus).toBe("out_of_stock");
  });
});

describe("composeLiveListings", () => {
  it("maps each seed through applyServerPrice", () => {
    const seeds = [listing(), listing({ distributorId: "dist-2" })];
    const results = [serverResult(), null];
    const composed = composeLiveListings(seeds, results);
    expect(composed[0].price).toBe(90);
    expect(composed[1].price).toBe(100);
  });
});

describe("deriveListingQueries", () => {
  it("builds one query config per listing keyed by distributor and model", () => {
    const queries = deriveListingQueries("MODEL-1", [
      listing({ distributorId: "dist-1" }),
      listing({ distributorId: "dist-2" }),
    ]);
    expect(queries).toHaveLength(2);
    expect(queries[0].queryKey).toEqual(["price", "dist-1", "MODEL-1"]);
    expect(queries[1].queryKey).toEqual(["price", "dist-2", "MODEL-1"]);
    expect(queries[0].staleTime).toBe(60_000);
    expect(queries[0].retry).toBe(1);
    expect(typeof queries[0].queryFn).toBe("function");
  });
});

describe("mergeSampleHistory", () => {
  it("fills history on listings missing it, matching by distributorId", () => {
    const sample = [
      listing({
        distributorId: "dist-1",
        priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
      }),
    ];
    const result = mergeSampleHistory([listing()], sample);
    expect(result[0].priceHistory).toHaveLength(1);
  });

  it("leaves listings with history untouched", () => {
    const sample = [
      listing({
        distributorId: "dist-1",
        priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
      }),
    ];
    const withHistory = listing({
      priceHistory: [point("2026-08-01T09:00:00.000Z", 80)],
    });
    const result = mergeSampleHistory([withHistory], sample);
    expect(result[0].priceHistory[0].price).toBe(80);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/live-prices.test.ts`
Expected: FAIL — modules `../lib/live-prices` and `../lib/health` cannot be resolved.

- [ ] **Step 3: Create `lib/live-prices.ts`**

```ts
import { appendPricePoint, mergePriceHistory } from "@/lib/price-history";
import { fetchServerPrice } from "@/lib/server-prices";
import type {
  DistributorListing,
  PricePoint,
  ServerPriceResult,
} from "@/lib/types";

export const PRICE_HISTORY_DAYS = 90;
export const PRICE_STALE_TIME_MS = 60_000;

export type ConnectionStatus = "connected" | "signed-out" | "offline";

export function deriveConnectionStatus(args: {
  reachable: boolean;
  isAuthenticated: boolean;
}): ConnectionStatus {
  if (!args.reachable) return "offline";
  return args.isAuthenticated ? "connected" : "signed-out";
}

export function applyServerPrice(
  listing: DistributorListing,
  serverResult: ServerPriceResult | null,
): DistributorListing {
  if (!serverResult) return listing;
  const now = new Date().toISOString();
  const mergedHistory = mergePriceHistory(
    listing.priceHistory,
    serverResult.history,
    PRICE_HISTORY_DAYS,
  );
  const snapshot = serverResult.snapshot;
  if (!snapshot) {
    return { ...listing, priceHistory: mergedHistory };
  }
  const snapshotPoint: PricePoint = {
    date: now,
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
  };
  return {
    ...listing,
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
    expectedDate: snapshot.expectedDate,
    url: snapshot.url,
    lastChecked: now,
    priceHistory: appendPricePoint(
      mergedHistory,
      snapshotPoint,
      PRICE_HISTORY_DAYS,
    ),
  };
}

export function composeLiveListings(
  seeds: DistributorListing[],
  results: (ServerPriceResult | null)[],
): DistributorListing[] {
  return seeds.map((seed, i) => applyServerPrice(seed, results[i] ?? null));
}

export function deriveListingQueries(
  modelNumber: string,
  listings: DistributorListing[],
) {
  return listings.map((listing) => ({
    queryKey: ["price", listing.distributorId, modelNumber] as const,
    queryFn: () => fetchServerPrice(listing.distributorId, modelNumber),
    staleTime: PRICE_STALE_TIME_MS,
    retry: 1,
  }));
}

export function mergeSampleHistory(
  listings: DistributorListing[],
  sampleListings: DistributorListing[],
): DistributorListing[] {
  return listings.map((l) => {
    if (l.priceHistory && l.priceHistory.length >= 2) return l;
    const sample = sampleListings.find(
      (s) => s.distributorId === l.distributorId,
    );
    return sample ? { ...l, priceHistory: sample.priceHistory } : l;
  });
}
```

- [ ] **Step 4: Create `lib/health.ts`**

```ts
import { getApiBaseUrl } from "@/constants/oauth";

const HEALTH_TIMEOUT_MS = 3000;

export async function checkHealth(): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return false;
  try {
    const res = await Promise.race([
      fetch(`${baseUrl}/api/health`).catch(() => null),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), HEALTH_TIMEOUT_MS),
      ),
    ]);
    return res?.ok ?? false;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- tests/live-prices.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

- [ ] **Step 7: Commit**

```bash
git add lib/live-prices.ts lib/health.ts tests/live-prices.test.ts
git commit -m "feat(live-prices): add pure live-price merge and connection helpers"
```

---

### Task 3: React Query live price hooks

**Files:**
- Create: `hooks/use-live-prices.ts`
- Test: `tests/use-live-prices.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/use-live-prices.test.tsx`:

```tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useLiveProduct } from "../hooks/use-live-prices";
import type {
  DistributorListing,
  Product,
  ServerPriceResult,
} from "../lib/types";

vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn(),
  updateProductListings: vi.fn(),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
}));

import { getWatchlist, updateProductListings } from "../lib/storage";
import { fetchServerPrice } from "../lib/server-prices";

const listing: DistributorListing = {
  distributorId: "dist-1",
  productId: "p1",
  price: 100,
  currency: "USD",
  stockStatus: "out_of_stock",
  url: "https://example.com",
  lastChecked: "2026-08-01T00:00:00.000Z",
  priceHistory: [],
};

const product: Product = {
  id: "p1",
  name: "Test Product",
  modelNumber: "MODEL-1",
  brand: "Test",
  category: "Router",
  description: "",
  addedAt: "2026-08-01T00:00:00.000Z",
  isWatched: true,
  listings: [listing],
};

const serverResult: ServerPriceResult = {
  snapshot: {
    price: 90,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com",
    fetchedAt: Date.now(),
  },
  history: [],
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useLiveProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWatchlist).mockResolvedValue([product]);
    vi.mocked(fetchServerPrice).mockResolvedValue(serverResult);
  });

  it("renders the seed listing immediately and hydrates the server snapshot", async () => {
    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.listings[0].price).toBe(100);

    await waitFor(() => expect(result.current.listings[0].price).toBe(90));
    expect(result.current.listings[0].stockStatus).toBe("in_stock");
    expect(fetchServerPrice).toHaveBeenCalledWith("dist-1", "MODEL-1");
  });

  it("keeps the seed listing when the server fetch fails", async () => {
    vi.mocked(fetchServerPrice).mockResolvedValue(null);
    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    await waitFor(() =>
      expect(result.current.listings[0].price).toBe(100),
    );
    expect(result.current.listings[0].stockStatus).toBe("out_of_stock");
  });

  it("refetches on refresh()", async () => {
    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.listings[0].price).toBe(90));
    expect(fetchServerPrice).toHaveBeenCalledTimes(1);

    await result.current.refresh();
    await waitFor(() => expect(fetchServerPrice).toHaveBeenCalledTimes(2));
  });

  it("persists merged listings after a successful fetch", async () => {
    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.listings[0].price).toBe(90));
    await waitFor(
      () => expect(updateProductListings).toHaveBeenCalled(),
      { timeout: 2000 },
    );
    const [calledId, calledListings] = vi.mocked(
      updateProductListings,
    ).mock.calls[0] as [string, DistributorListing[]];
    expect(calledId).toBe("p1");
    expect(calledListings[0].price).toBe(90);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/use-live-prices.test.tsx`
Expected: FAIL — module `../hooks/use-live-prices` cannot be resolved.

- [ ] **Step 3: Create `hooks/use-live-prices.ts`**

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { PRODUCT_CATALOG } from "@/lib/catalog";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";
import {
  composeLiveListings,
  deriveListingQueries,
  mergeSampleHistory,
} from "@/lib/live-prices";
import { getWatchlist, updateProductListings } from "@/lib/storage";
import type { DistributorListing, Product } from "@/lib/types";

const PERSIST_DEBOUNCE_MS = 500;

export function useLiveProduct(productId: string) {
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [seedListings, setSeedListings] = useState<DistributorListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadSeed = useCallback(async () => {
    const watchlist = await getWatchlist();
    if (!mounted.current) return;
    const found = watchlist.find((p) => p.id === productId);
    const sample = SAMPLE_LISTINGS[productId] ?? [];
    let seed: DistributorListing[];
    if (found) {
      const base = found.listings ?? [];
      if (base.length === 0) {
        seed = sample;
        if (sample.length > 0) {
          void updateProductListings(productId, sample);
        }
      } else {
        seed = mergeSampleHistory(base, sample);
      }
      setProduct(found);
    } else {
      seed = sample;
      setProduct(null);
    }
    setSeedListings(seed);
    setLoaded(true);
  }, [productId]);

  useEffect(() => {
    mounted.current = true;
    void loadSeed();
    return () => {
      mounted.current = false;
    };
  }, [loadSeed]);

  const modelNumber =
    product?.modelNumber ??
    PRODUCT_CATALOG.find((p) => p.id === productId)?.modelNumber;

  const queries = useMemo(
    () => (modelNumber ? deriveListingQueries(modelNumber, seedListings) : []),
    [modelNumber, seedListings],
  );

  const results = useQueries({ queries });

  const listings = useMemo(
    () =>
      composeLiveListings(seedListings, results.map((r) => r.data ?? null)),
    [seedListings, results],
  );

  const hasLiveData = useMemo(
    () => results.some((r) => r.data != null),
    [results],
  );

  useEffect(() => {
    if (!loaded || !product || !hasLiveData) return;
    const timer = setTimeout(() => {
      void updateProductListings(productId, listings);
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loaded, product, productId, listings, hasLiveData]);

  const refresh = useCallback(async () => {
    await loadSeed();
    await queryClient.invalidateQueries({ queryKey: ["price"] });
  }, [loadSeed, queryClient]);

  const isRefreshingAny = results.some((r) => r.isFetching);

  const lastUpdatedAt = useMemo(() => {
    let max = 0;
    for (const r of results) {
      if (r.dataUpdatedAt > max) max = r.dataUpdatedAt;
    }
    return max || null;
  }, [results]);

  return {
    product,
    listings,
    loaded,
    isRefreshingAny,
    lastUpdatedAt,
    refresh,
  };
}

export function useLiveWatchlist() {
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const list = await getWatchlist();
    if (!mounted.current) return;
    setProducts(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const queries = useMemo(
    () => products.flatMap((p) => deriveListingQueries(p.modelNumber, p.listings ?? [])),
    [products],
  );

  const results = useQueries({ queries });

  const liveProducts = useMemo(() => {
    let idx = 0;
    return products.map((p) => {
      const count = p.listings?.length ?? 0;
      const productResults = results
        .slice(idx, idx + count)
        .map((r) => r.data ?? null);
      idx += count;
      return {
        ...p,
        listings: composeLiveListings(p.listings ?? [], productResults),
      };
    });
  }, [products, results]);

  const hasLiveData = useMemo(
    () => results.some((r) => r.data != null),
    [results],
  );

  useEffect(() => {
    if (!loaded || !hasLiveData) return;
    const timer = setTimeout(() => {
      for (const p of liveProducts) {
        void updateProductListings(p.id, p.listings);
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loaded, liveProducts, hasLiveData]);

  const refreshAll = useCallback(async () => {
    await reload();
    await queryClient.invalidateQueries({ queryKey: ["price"] });
  }, [reload, queryClient]);

  const isRefreshingAny = results.some((r) => r.isFetching);

  const lastUpdatedAt = useMemo(() => {
    let max = 0;
    for (const r of results) {
      if (r.dataUpdatedAt > max) max = r.dataUpdatedAt;
    }
    return max || null;
  }, [results]);

  return {
    products: liveProducts,
    loaded,
    isRefreshingAny,
    lastUpdatedAt,
    reload,
    refreshAll,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- tests/use-live-prices.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-live-prices.ts tests/use-live-prices.test.tsx
git commit -m "feat(use-live-prices): add React Query live price hooks"
```

---

### Task 4: Connection status hook

**Files:**
- Create: `hooks/use-connection.ts`

- [ ] **Step 1: Create `hooks/use-connection.ts`**

```ts
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { checkHealth } from "@/lib/health";
import { deriveConnectionStatus } from "@/lib/live-prices";

const REFETCH_INTERVAL_MS = 60_000;

export function useConnection() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["connection"],
    queryFn: checkHealth,
    refetchInterval: REFETCH_INTERVAL_MS,
    retry: 1,
  });

  const refetch = useCallback(() => {
    void queryClient.refetchQueries({ queryKey: ["connection"] });
  }, [queryClient]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const reachable = query.data ?? false;
  const status = deriveConnectionStatus({ reachable, isAuthenticated });

  return {
    status,
    reachable,
    isRefreshing: query.isFetching,
    lastCheckedAt: query.dataUpdatedAt || null,
    refetch,
  };
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-connection.ts
git commit -m "feat(use-connection): add backend connection status hook"
```

---

### Task 5: Connection badge component + Home header badge

**Files:**
- Create: `components/connection-badge.tsx`
- Modify: `app/(tabs)/index.tsx` (header at lines 184-211)

- [ ] **Step 1: Create `components/connection-badge.tsx`**

```tsx
import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { ConnectionStatus } from "@/lib/live-prices";

const CONFIG: Record<
  ConnectionStatus,
  { label: string; color: "success" | "warning" | "error" }
> = {
  connected: { label: "Connected", color: "success" },
  "signed-out": { label: "Signed out", color: "warning" },
  offline: { label: "Offline", color: "error" },
};

export function ConnectionBadge({
  status,
  onPress,
}: {
  status: ConnectionStatus;
  onPress?: () => void;
}) {
  const colors = useColors();
  const c = CONFIG[status];
  const color = colors[c.color];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: colors.surface,
        borderRadius: 20,
        paddingHorizontal: 10,
        height: 32,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text
        style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}
      >
        {c.label}
      </Text>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Wire the badge into the Home header**

In `app/(tabs)/index.tsx`:

1. Add imports after the existing imports (near line 18):
```tsx
import { ConnectionBadge } from "@/components/connection-badge";
import { useConnection } from "@/hooks/use-connection";
```

2. Inside `HomeScreen`, after `const colors = useColors();` (line 117) add:
```tsx
const connection = useConnection();
```

3. Replace the header block (currently lines 184-211, ending with the `+` `TouchableOpacity`) so the `+` button is wrapped in a row with the badge:

```tsx
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              Product Stock Finder
            </Text>
            <Text className="text-muted text-sm">
              Global availability monitor
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ConnectionBadge
              status={connection.status}
              onPress={
                connection.status === "signed-out"
                  ? () => router.push("/settings")
                  : undefined
              }
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/search");
              }}
            >
              <IconSymbol name="plus" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean.

- [ ] **Step 4: Commit**

```bash
git add components/connection-badge.tsx "app/(tabs)/index.tsx"
git commit -m "feat(home): add connection status badge to header"
```

---

### Task 6: Settings Connection card

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add imports**

In `app/(tabs)/settings.tsx`, add after the existing imports:
```tsx
import { useConnection } from "@/hooks/use-connection";
import { formatLastRefreshed } from "@/lib/last-refreshed";
```

- [ ] **Step 2: Add the connection hook**

Inside the settings screen component, near `const { user, isAuthenticated, logout } = useAuth();` (line 163) add:
```tsx
const connection = useConnection();
```

- [ ] **Step 3: Insert the Connection card before the Account section**

Insert this block between the settings title `</View>` (ends line 464) and `<SectionHeader title="Account" />` (line 466):

```tsx
        <SectionHeader title="Connection" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          <SettingRow
            icon="network"
            label="Backend"
            description={
              connection.status === "connected"
                ? "Live prices available"
                : connection.status === "signed-out"
                  ? "Reachable — sign in to sync"
                  : "Unreachable — showing last known prices"
            }
            descriptionColor={
              connection.status === "connected"
                ? colors.success
                : connection.status === "signed-out"
                  ? colors.warning
                  : colors.error
            }
            right={
              <Text
                style={{
                  color:
                    connection.status === "connected"
                      ? colors.success
                      : connection.status === "signed-out"
                        ? colors.warning
                        : colors.error,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {connection.status === "connected"
                  ? "Connected"
                  : connection.status === "signed-out"
                    ? "Signed out"
                    : "Offline"}
              </Text>
            }
          />
          {connection.lastCheckedAt ? (
            <SettingRow
              icon="clock.fill"
              label="Last checked"
              description={formatLastRefreshed(
                new Date(connection.lastCheckedAt).toISOString(),
              )}
              right={<View />}
            />
          ) : null}
          {connection.status === "signed-out" ? (
            <SettingRow
              icon="person.crop.circle.badge.plus"
              label="Sign in to sync"
              description="Connect your account to refresh live prices"
              right={
                <TouchableOpacity
                  onPress={handleSignIn}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.primary + "22",
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Sign in
                  </Text>
                </TouchableOpacity>
              }
            />
          ) : null}
        </View>
```

Note: `handleSignIn` (defined at line 299) and `SettingRow`/`SectionHeader` (defined at lines 52/113) already exist — reuse them.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/settings.tsx"
git commit -m "feat(settings): add backend connection status card"
```

---

### Task 7: Product detail live prices + refresh

**Files:**
- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Add the hook import**

Add after the existing imports (near line 68):
```tsx
import { useLiveProduct } from "@/hooks/use-live-prices";
```

- [ ] **Step 2: Replace product/listings state with the hook**

Replace lines 393-394:
```tsx
  const [product, setProduct] = useState<Product | null>(null);
  const [listings, setListings] = useState<DistributorListing[]>([]);
```
with:
```tsx
  const { product, listings, loaded, isRefreshingAny, refresh } =
    useLiveProduct(id);
```

- [ ] **Step 3: Remove the `loading` state**

Remove line 397:
```tsx
  const [loading, setLoading] = useState(true);
```

- [ ] **Step 4: Slim `loadData` to insight/image only**

Replace the `loadData` body (lines 427-449) with:
```tsx
  const loadData = useCallback(async () => {
    void fetchPriceInsight(id).then((res) => {
      if (res) setInsight(res.insight);
    });
    void fetchProductImage(id).then((res) => {
      if (res) setProductImage(res.imageUrl);
    });
  }, [id]);
```

- [ ] **Step 5: Replace the loading gate**

Replace `if (loading) {` (line 752) with:
```tsx
  if (!loaded) {
```

- [ ] **Step 6: Wire the Refresh button to the live refresh**

Replace the Refresh `TouchableOpacity` (lines 1061-1093) with:
```tsx
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void refresh();
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingVertical: 13,
              paddingHorizontal: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              gap: 6,
            }}
          >
            {isRefreshingAny ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <IconSymbol
                name="arrow.clockwise"
                size={16}
                color={colors.foreground}
              />
            )}
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              Refresh
            </Text>
          </TouchableOpacity>
```

- [ ] **Step 7: Remove now-unused imports if the typecheck flags them**

If `pnpm check` reports `Product` or `DistributorListing` as unused (they may still be used by `reminderListing`/`chartListing` state types — keep them if so), remove only the ones that are truly unused. Do not remove `useState` (used by many other states).

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean.

- [ ] **Step 9: Commit**

```bash
git add "app/product/[id].tsx"
git commit -m "feat(product): render live prices with server refresh"
```

---

### Task 8: Compare screen live prices + refresh

**Files:**
- Modify: `app/compare/[id].tsx`

- [ ] **Step 1: Adjust imports**

1. Add:
```tsx
import { useLiveProduct } from "@/hooks/use-live-prices";
```
2. Remove the now-unused `SAMPLE_LISTINGS` import (line 23) and `getWatchlist` import if present — the hook handles both. Keep `PRODUCT_CATALOG` (still used for the product name fallback).

- [ ] **Step 2: Replace the data-loading effect with the hook**

Replace the `useEffect` (lines 410-471) with:
```tsx
  const { product, listings, loaded, isRefreshingAny, refresh } =
    useLiveProduct(id);

  const productName =
    product?.name ??
    PRODUCT_CATALOG.find((p) => p.id === id)?.name ??
    (id as string);

  const notFound = loaded && listings.length === 0;

  const selectionInitialized = useRef(false);
  useEffect(() => {
    if (!loaded || selectionInitialized.current) return;
    selectionInitialized.current = true;
    const withHistory = listings.filter(
      (l) => l.priceHistory && l.priceHistory.length >= 2,
    );
    setSelected(new Set(withHistory.slice(0, 3).map((l) => l.distributorId)));
  }, [loaded, listings]);
```

- [ ] **Step 3: Remove the `loading` and `productName` state declarations**

Remove these lines (currently 402 and 405):
```tsx
  const [productName, setProductName] = useState("");
  const [loading, setLoading] = useState(true);
```
Keep `notFound` as a derived value (no state). Remove any `setLoading`/`setProductName`/`setNotFound` calls that were inside the deleted effect.

- [ ] **Step 4: Replace the loading gate**

Find the render gate that uses `loading` (search for `if (loading)` in the file) and replace with:
```tsx
  if (!loaded) {
```

- [ ] **Step 5: Add a Refresh button to the header**

In the header `View` (lines 650-688), after the title `View` (the one with `flex: 1` ending at line 687) and before the closing `</View>` of the header, add:
```tsx
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void refresh();
              }}
              style={{ padding: 4 }}
            >
              {isRefreshingAny ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <IconSymbol
                  name="arrow.clockwise"
                  size={22}
                  color={colors.foreground}
                />
              )}
            </TouchableOpacity>
```

- [ ] **Step 6: Ensure `ActivityIndicator`, `useRef`, and `Haptics` are imported**

- `ActivityIndicator`: add to the `react-native` import if missing.
- `useRef`: add to the `react` import if missing.
- `Haptics`: already imported (used at line 474).

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean.

- [ ] **Step 8: Commit**

```bash
git add "app/compare/[id].tsx"
git commit -m "feat(compare): render live prices with server refresh"
```

---

### Task 9: Watchlist live prices + Refresh all

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Adjust imports**

1. Add:
```tsx
import { useLiveWatchlist } from "@/hooks/use-live-prices";
import { useFocusEffect } from "expo-router";
```
2. Remove `refreshWatchlistPrices` from the `@/lib/storage` import (line 22) if it becomes unused. Keep `getWatchlist` only if still referenced elsewhere; it is not after Step 3 — remove it if the typecheck flags it.

- [ ] **Step 2: Replace the watchlist state with the hook**

Replace line 263:
```tsx
  const [watchlist, setWatchlist] = useState<Product[]>([]);
```
with:
```tsx
  const { products: watchlist, isRefreshingAny, reload, refreshAll } =
    useLiveWatchlist();
```

- [ ] **Step 3: Slim `loadData` to settings only**

Replace the `loadData` body (lines 275-280) with:
```tsx
  const loadData = useCallback(async () => {
    const settings = await getSettings();
    setDisplayCurrency(settings?.displayCurrency ?? "USD");
  }, []);
```

- [ ] **Step 4: Add a focus reload**

Replace the mount-only `useEffect` (lines 282-284) with:
```tsx
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );
```

- [ ] **Step 5: Wire pull-to-refresh to the live refresh**

Replace `onRefresh` (lines 299-304) with:
```tsx
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);
```

- [ ] **Step 6: Re-seed after Check Now**

In `handleCheckNow` (lines 331-346), after `await checkPriceDropsNow(...)` and before `await loadData();`, add:
```tsx
      await reload();
```

- [ ] **Step 7: Add a "Refresh" button to the header**

In the header action row (lines 358-430), insert this button between the "Analysis" `TouchableOpacity` (ends line 387) and the "Check Now" `TouchableOpacity` (starts line 388):

```tsx
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void refreshAll();
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {isRefreshingAny ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol
                name="arrow.clockwise"
                size={16}
                color={colors.primary}
              />
            )}
            <Text
              style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}
            >
              Refresh
            </Text>
          </TouchableOpacity>
```

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 TypeScript errors; lint clean.

- [ ] **Step 9: Commit**

```bash
git add "app/(tabs)/watchlist.tsx"
git commit -m "feat(watchlist): render live prices with refresh all"
```

---

### Task 10: Checkpoint

**Files:**
- Modify: `todo.md` (add Phase 45)

- [ ] **Step 1: Add the phase entry to `todo.md`**

Append a new phase entry at the end of `todo.md` matching the existing format (see the current tail, Phase 44). Example:

```markdown
## Phase 45 — End-to-End Live Mode (v4.5)

- [x] Connection status hook (`/api/health` probe + auth) with three states
- [x] Home header connection badge + Settings Connection card
- [x] React Query live price layer (`useLiveProduct` / `useLiveWatchlist`) with AsyncStorage seed + persistence
- [x] Product detail + compare render live prices with server refresh
- [x] Watchlist renders live prices with Refresh all + pull-to-refresh
```

- [ ] **Step 2: Run all gates**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TypeScript errors; lint clean; all tests pass (570 existing + new live-prices/use-live-prices tests).

- [ ] **Step 3: Commit the checkpoint**

```bash
git add todo.md
git commit -m "Checkpoint: v4.5: end-to-end live mode with connection indicator. TypeScript: 0 errors."
```