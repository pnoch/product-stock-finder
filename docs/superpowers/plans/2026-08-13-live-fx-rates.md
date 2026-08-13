# Live FX Rates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frozen static exchange rates in `lib/currency.ts` with live rates served by the backend (1h TTL, refresh on app launch and Settings visit), so every existing currency conversion uses up-to-date rates with graceful fallback to static.

**Architecture:** A server-side TTL-cached FX service (`server/fx.ts`) fetches USD-base rates from a free no-key provider (`https://open.er-api.com/v6/latest/USD`, overridable via `FX_API_URL`), caches in memory with single-flight + stale-while-revalidate, and exposes a public `fx.get` tRPC endpoint. `lib/currency.ts` gains a mutable live-rate overlay (`setExchangeRates`) so all existing `convertPrice`/`getBestPrice`/`hasExchangeRate` call sites pick up live rates unchanged. The mobile app persists last-known rates to AsyncStorage (`fx_rates`) and applies them at launch, refreshing in the background when stale.

**Tech Stack:** TypeScript 5.9 strict, Express + tRPC v11, vitest (node env, mocked global fetch), React Native / Expo, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-08-13-live-fx-rates-design.md`

---

### Task 1: Shared `FxRatesResult` type + dynamic rates in `lib/currency.ts`

**Files:**
- Modify: `lib/types.ts` (after `ServerPriceResult`, line 51)
- Modify: `lib/currency.ts`
- Test: `tests/currency.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/currency.test.ts`. Add `afterEach` to the vitest import and `setExchangeRates` to the currency import at the top:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EXCHANGE_RATES, convertPrice, setExchangeRates } from "../lib/currency";
import { FX_TTL_MS, getFxRates, clearFxCache } from "../server/fx";
```

Append a new `describe` block at the end of the file:

```ts
describe("live rates", () => {
  afterEach(() => setExchangeRates(null));

  it("uses live rates when set", () => {
    setExchangeRates({ EUR: 0.9 });
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(90);
  });

  it("falls back to static rates for codes missing from the live set", () => {
    setExchangeRates({ EUR: 0.9 });
    expect(convertPrice(100, "EUR", "GBP")).toBeCloseTo((100 / 0.9) * 0.79);
  });

  it("restores static rates when cleared with null", () => {
    setExchangeRates({ EUR: 0.9 });
    setExchangeRates(null);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(92);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/currency.test.ts`
Expected: FAIL — `setExchangeRates` is not exported from `../lib/currency`.

- [ ] **Step 3: Add `FxRatesResult` to `lib/types.ts`**

After the `ServerPriceResult` interface (line 51):

```ts
export interface ServerPriceResult {
  snapshot: PriceSnapshot | null;
  history: PricePoint[];
}
```

add:

```ts
export interface FxRatesResult {
  rates: Record<string, number>;
  fetchedAt: number | null;
}
```

- [ ] **Step 4: Implement dynamic rates in `lib/currency.ts`**

Add a live-rate overlay after the `CURRENCY_SYMBOLS` map:

```ts
let liveRates: Record<string, number> | null = null;

export function setExchangeRates(rates: Record<string, number> | null): void {
  liveRates = rates;
}

function effectiveRates(): Record<string, number> {
  return { ...EXCHANGE_RATES, ...liveRates };
}
```

Change `convertPrice` (lines 32-40) from:

```ts
export function convertPrice(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number {
  const fromRate = EXCHANGE_RATES[fromCurrency] ?? 1;
  const toRate = EXCHANGE_RATES[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}
```

to:

```ts
export function convertPrice(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number {
  const rates = effectiveRates();
  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}
```

Change `hasExchangeRate` (lines 42-44) from:

```ts
export function hasExchangeRate(currency: string): boolean {
  return currency in EXCHANGE_RATES;
}
```

to:

```ts
export function hasExchangeRate(currency: string): boolean {
  return currency in effectiveRates();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test tests/currency.test.ts`
Expected: PASS (existing tests plus the 3 new live-rates tests).

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/types.ts lib/currency.ts tests/currency.test.ts
git commit -m "feat(currency): dynamic exchange rates via setExchangeRates"
```

---

### Task 2: `fx_rates` AsyncStorage helpers

**Files:**
- Modify: `lib/storage.ts` (KEYS line 33, new section after line 356, `clearAllData` line 519, return object line 538, destructure block line 590)
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `getFxRates` and `saveFxRates` to the destructured import in `tests/storage.test.ts` (the import block at lines 28-61). Append a new `describe` block at the end of the file:

```ts
describe("fx rates", () => {
  it("returns null when nothing is stored", async () => {
    expect(await getFxRates()).toBeNull();
  });

  it("round-trips a rates payload", async () => {
    await saveFxRates({ rates: { EUR: 0.9, GBP: 0.78 }, fetchedAt: 123456 });
    expect(await getFxRates()).toEqual({
      rates: { EUR: 0.9, GBP: 0.78 },
      fetchedAt: 123456,
    });
  });

  it("returns null for a corrupt payload", async () => {
    store.set("fx_rates", "{not valid json");
    expect(await getFxRates()).toBeNull();
  });

  it("returns null for a payload without a rates object", async () => {
    store.set("fx_rates", JSON.stringify({ fetchedAt: 5 }));
    expect(await getFxRates()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/storage.test.ts`
Expected: FAIL — `getFxRates`/`saveFxRates` are not exported from `../lib/storage`.

- [ ] **Step 3: Implement the storage helpers**

In `lib/storage.ts`:

**3a.** Add to the `KEYS` object (after `NOTIFICATION_HISTORY`, line 33):

```ts
    FX_RATES: "fx_rates",
```

**3b.** Add a new section after the Price Digest Snapshot section (after line 356):

```ts
  // ─── FX Rates ───────────────────────────────────────────────────────────────

  async function getFxRates(): Promise<{
    rates: Record<string, number>;
    fetchedAt: number;
  } | null> {
    try {
      const raw = await adapter.getItem(KEYS.FX_RATES);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        rates?: unknown;
        fetchedAt?: unknown;
      };
      if (!parsed || typeof parsed !== "object" || !parsed.rates) return null;
      return {
        rates: parsed.rates as Record<string, number>,
        fetchedAt:
          typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0,
      };
    } catch {
      return null;
    }
  }

  async function saveFxRates(payload: {
    rates: Record<string, number>;
    fetchedAt: number;
  }): Promise<void> {
    await adapter.setItem(KEYS.FX_RATES, JSON.stringify(payload));
  }
```

**3c.** Add `KEYS.FX_RATES` to the `clearAllData()` array (after `KEYS.NOTIFICATION_HISTORY`, line 528):

```ts
      KEYS.NOTIFICATION_HISTORY,
      KEYS.FX_RATES,
```

**3d.** Add `getFxRates,` and `saveFxRates,` to the `createStorage` return object (after `savePriceDigestSnapshot`, line 564).

**3e.** Add `getFxRates,` and `saveFxRates,` to the default-instance destructure block (after `savePriceDigestSnapshot`, line 616).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/storage.test.ts`
Expected: PASS (all tests including the 4 new fx rates tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/storage.ts tests/storage.test.ts
git commit -m "feat(storage): persist live FX rates (fx_rates key)"
```

---

### Task 3: Server FX service + `fx.get` endpoint

**Files:**
- Create: `server/fx.ts`
- Modify: `server/routers.ts` (add `fx` router after `prices`, ~line 110)
- Create: `tests/fx.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/fx.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { EXCHANGE_RATES, convertPrice, setExchangeRates } from "../lib/currency";
import { FX_TTL_MS, getFxRates, clearFxCache } from "../server/fx";

function mockResponse(rates: Record<string, number>) {
  return {
    ok: true,
    json: async () => ({ result: "success", base_code: "USD", rates }),
  };
}

const fetchMock = vi.fn();

describe("fx service", () => {
  beforeEach(() => {
    clearFxCache();
    setExchangeRates(null);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and caches live rates on first call", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.88, GBP: 0.77 }));
    const result = await getFxRates();
    expect(result.fetchedAt).not.toBeNull();
    expect(result.rates.EUR).toBe(0.88);
    expect(result.rates.GBP).toBe(0.77);
    expect(result.rates.USD).toBe(1);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(88);
  });

  it("returns a fresh cache without refetching", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.9 }));
    await getFxRates();
    fetchMock.mockClear();
    const result = await getFxRates();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.rates.EUR).toBe(0.9);
  });

  it("returns cached rates while refreshing when the cache is stale", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.9 }));
      await getFxRates();
      vi.setSystemTime(1_000_000 + FX_TTL_MS + 1000);
      fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.85 }));
      const result = await getFxRates();
      expect(result.fetchedAt).toBe(1_000_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(0);
      const next = await getFxRates();
      expect(next.rates.EUR).toBe(0.85);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to static rates without throwing when the provider fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await getFxRates();
    expect(result.fetchedAt).toBeNull();
    expect(result.rates.EUR).toBe(EXCHANGE_RATES.EUR);
  });

  it("falls back to static rates on a non-ok or malformed response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ result: "error" }),
    });
    const bad = await getFxRates();
    expect(bad.fetchedAt).toBeNull();
    expect(bad.rates.EUR).toBe(EXCHANGE_RATES.EUR);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: "error" }) });
    const malformed = await getFxRates();
    expect(malformed.fetchedAt).toBeNull();
    expect(malformed.rates.EUR).toBe(EXCHANGE_RATES.EUR);
  });

  it("shares a single fetch across concurrent calls with an empty cache", async () => {
    let resolveFetch: (value: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        }),
    );
    const p1 = getFxRates();
    const p2 = getFxRates();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveFetch!(mockResponse({ EUR: 0.9 }));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1.fetchedAt).not.toBeNull();
    expect(r2.fetchedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/fx.test.ts`
Expected: FAIL — cannot find module `../server/fx` (also note the import `vi` fix above).

- [ ] **Step 3: Implement `server/fx.ts`**

```ts
import { EXCHANGE_RATES, setExchangeRates } from "../lib/currency";
import type { FxRatesResult } from "../lib/types";

export const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

interface FxCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: FxCache | null = null;
let inFlight: Promise<FxCache | null> | null = null;

function providerUrl(): string {
  return process.env.FX_API_URL ?? "https://open.er-api.com/v6/latest/USD";
}

function parseRates(body: unknown): Record<string, number> | null {
  if (!body || typeof body !== "object") return null;
  const rates = (body as { rates?: unknown }).rates;
  if (!rates || typeof rates !== "object" || rates === null) return null;
  const out: Record<string, number> = {};
  for (const [code, value] of Object.entries(rates as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) out[code] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function refreshFromProvider(): Promise<FxCache | null> {
  try {
    const response = await fetch(providerUrl());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    const rates = parseRates(body);
    if (!rates) return null;
    const next: FxCache = { rates, fetchedAt: Date.now() };
    cache = next;
    setExchangeRates(rates);
    return next;
  } catch (error) {
    console.warn("[Fx] Failed to fetch rates:", error);
    return null;
  }
}

function refreshSingleFlight(): Promise<FxCache | null> {
  if (inFlight) return inFlight;
  inFlight = refreshFromProvider().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function getFxRates(): Promise<FxRatesResult> {
  if (cache && Date.now() - cache.fetchedAt < FX_TTL_MS) {
    return { rates: { ...EXCHANGE_RATES, ...cache.rates }, fetchedAt: cache.fetchedAt };
  }
  if (cache) {
    void refreshSingleFlight();
    return { rates: { ...EXCHANGE_RATES, ...cache.rates }, fetchedAt: cache.fetchedAt };
  }
  const fetched = await refreshSingleFlight();
  if (fetched) {
    return { rates: { ...EXCHANGE_RATES, ...fetched.rates }, fetchedAt: fetched.fetchedAt };
  }
  return { rates: EXCHANGE_RATES, fetchedAt: null };
}

export function clearFxCache(): void {
  cache = null;
  inFlight = null;
}
```

- [ ] **Step 4: Add the `fx` router to `server/routers.ts`**

Add `getFxRates` to the import from `./prices` (line 13). Keep the existing import and add a new one after it:

```ts
import { getPrice } from "./prices";
import { getFxRates } from "./fx";
```

Add the `fx` router after the `prices` router block (after line 106, before `insights`):

```ts
  fx: router({
    get: publicProcedure.query(async () => {
      return getFxRates();
    }),
  }),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test tests/fx.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add server/fx.ts server/routers.ts tests/fx.test.ts
git commit -m "feat(server): TTL-cached FX rates endpoint (fx.get)"
```

---

### Task 4: Mobile `lib/fx.ts` helper

**Files:**
- Create: `lib/fx.ts`
- Create: `tests/fx-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/fx-client.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { convertPrice, setExchangeRates } from "../lib/currency";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { loadFxRates, refreshFxRates, maybeRefreshFxRates, FX_TTL_MS } from "../lib/fx";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockQuery(result: unknown) {
  const query = vi.fn(async () => result);
  mockedCreateClient.mockReturnValue({
    fx: { get: { query } },
  } as never);
  return query;
}

describe("fx client", () => {
  beforeEach(() => {
    store.clear();
    setExchangeRates(null);
  });

  it("loadFxRates applies stored rates to conversions", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({ rates: { EUR: 0.9 }, fetchedAt: Date.now() }),
    );
    await loadFxRates();
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(90);
  });

  it("refreshFxRates fetches, persists, and applies live rates", async () => {
    mockQuery({ rates: { EUR: 0.88 }, fetchedAt: 2000 });
    await refreshFxRates();
    expect(JSON.parse(store.get("fx_rates")!).rates.EUR).toBe(0.88);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(88);
  });

  it("refreshFxRates is a no-op when the fetch fails", async () => {
    mockQuery(new Error("network down"));
    await refreshFxRates();
    expect(store.has("fx_rates")).toBe(false);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(92);
  });

  it("maybeRefreshFxRates skips when stored rates are fresh", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({ rates: { EUR: 0.9 }, fetchedAt: Date.now() }),
    );
    const query = mockQuery({ rates: { EUR: 0.8 }, fetchedAt: Date.now() });
    await maybeRefreshFxRates();
    expect(query).not.toHaveBeenCalled();
  });

  it("maybeRefreshFxRates refreshes when stored rates are stale", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({
        rates: { EUR: 0.9 },
        fetchedAt: Date.now() - FX_TTL_MS - 1000,
      }),
    );
    const query = mockQuery({ rates: { EUR: 0.8 }, fetchedAt: Date.now() });
    await maybeRefreshFxRates();
    expect(query).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get("fx_rates")!).rates.EUR).toBe(0.8);
  });
});
```

Note: the failure test's `mockQuery(new Error(...))` — `vi.fn(async () => result)` must reject so the client treats it as a failure. Change that helper to throw when given an `Error`:

```ts
function mockQuery(result: unknown) {
  const query = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  mockedCreateClient.mockReturnValue({
    fx: { get: { query } },
  } as never);
  return query;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/fx-client.test.ts`
Expected: FAIL — cannot find module `../lib/fx` (or functions not exported).

- [ ] **Step 3: Implement `lib/fx.ts`**

```ts
import { createTRPCClient } from "./trpc";
import { defaultStorage, type Storage } from "./storage";
import { setExchangeRates } from "./currency";
import type { FxRatesResult } from "./types";

const TIMEOUT_MS = 4000;

export const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchFxRates(): Promise<FxRatesResult | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.fx.get.query(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!result || typeof result.rates !== "object" || result.rates === null) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

export async function loadFxRates(storage: Storage = defaultStorage): Promise<void> {
  const stored = await storage.getFxRates();
  if (stored) setExchangeRates(stored.rates);
}

export async function refreshFxRates(storage: Storage = defaultStorage): Promise<void> {
  const result = await fetchFxRates();
  if (!result) return;
  await storage.saveFxRates({
    rates: result.rates,
    fetchedAt: result.fetchedAt ?? Date.now(),
  });
  setExchangeRates(result.rates);
}

export async function maybeRefreshFxRates(storage: Storage = defaultStorage): Promise<void> {
  const stored = await storage.getFxRates();
  const fresh =
    stored !== null &&
    stored.fetchedAt > 0 &&
    Date.now() - stored.fetchedAt < FX_TTL_MS;
  if (!fresh) await refreshFxRates(storage);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/fx-client.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add lib/fx.ts tests/fx-client.test.ts
git commit -m "feat(fx): mobile live rates helper (fetch/load/refresh)"
```

---

### Task 5: Wiring + checkpoint commit

**Files:**
- Modify: `app/_layout.tsx` (imports + launch effect)
- Modify: `app/(tabs)/settings.tsx` (import + settings effect)
- Modify: `todo.md` (Phase 38)

- [ ] **Step 1: Wire launch refresh in `app/_layout.tsx`**

Add to the imports (after the `@/lib/push-token` import, line 47):

```ts
import { loadFxRates, maybeRefreshFxRates } from "@/lib/fx";
```

Add a launch effect after the auth-sync effect (after line 204):

```tsx
  useEffect(() => {
    void loadFxRates();
    void maybeRefreshFxRates();
  }, []);
```

- [ ] **Step 2: Wire Settings refresh in `app/(tabs)/settings.tsx`**

Add to the imports (after the `@/lib/sync` import):

```ts
import { maybeRefreshFxRates } from "@/lib/fx";
```

Change the settings-loading effect (lines 154-157) from:

```tsx
  useEffect(() => {
    getSettings().then(setSettings);
    getWatchlist().then(setProducts);
  }, []);
```

to:

```tsx
  useEffect(() => {
    getSettings().then(setSettings);
    getWatchlist().then(setProducts);
    void maybeRefreshFxRates();
  }, []);
```

- [ ] **Step 3: Typecheck, lint, and full test suite**

Run: `pnpm check`
Expected: 0 errors.

Run: `pnpm lint`
Expected: PASS (only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning).

Run: `pnpm test`
Expected: PASS — all suites green (including the new fx tests from Tasks 1-4).

- [ ] **Step 4: Format**

Run: `pnpm exec prettier --write lib/currency.ts lib/fx.ts lib/storage.ts lib/types.ts server/fx.ts server/routers.ts "app/(tabs)/settings.tsx" app/_layout.tsx tests/currency.test.ts tests/storage.test.ts tests/fx.test.ts tests/fx-client.test.ts`
Expected: formatting applied (no errors).

- [ ] **Step 5: Add Phase 38 to `todo.md`**

Append at the end of `todo.md`:

```markdown
## Phase 38: Live FX Rates

- [x] Server TTL-cached FX service (server/fx.ts) + public fx.get endpoint (1h TTL, single-flight, stale-while-revalidate)
- [x] FX provider URL configurable via FX_API_URL (default open.er-api.com/v6/latest/USD, no key)
- [x] Dynamic rates in lib/currency.ts (setExchangeRates overlay; fallback to static)
- [x] Mobile fx helper: fetch/load/refresh + maybeRefresh (lib/fx.ts), persisted to fx_rates AsyncStorage
- [x] Launch + Settings refresh wiring; every existing conversion uses live rates
- [x] Tests: fx service (6), currency live-rates (3), storage round-trip (4), fx client (5)
```

- [ ] **Step 6: Review and checkpoint commit**

Review the full diff (`git diff <task-4-sha> HEAD` — or `git log --oneline -6`) for cross-task consistency: `FxRatesResult` shape (`rates`/`fetchedAt`), `setExchangeRates(null)` reset, `FX_TTL_MS` value (1h) in both `server/fx.ts` and `lib/fx.ts`.

```bash
git add todo.md
git commit -m "Checkpoint: v3.17: Live FX rates — TTL-cached server fx.get endpoint, dynamic currency module with static fallback, mobile fetch/load/refresh wired at launch and Settings. TypeScript: 0 errors."
```

- [ ] **Step 7: Push**

```bash
git push
```
