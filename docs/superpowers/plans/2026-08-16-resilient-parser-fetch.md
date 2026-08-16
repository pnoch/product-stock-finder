# Implementation Plan: Resilient Parser Fetch

- **Date:** 2026-08-16
- **Status:** Ready for implementation
- **Design:** `docs/superpowers/specs/2026-08-16-resilient-parser-fetch-design.md` (approved)
- **Branch:** work on `main` directly (all prior work pushed to `origin/main`)

## Overview

Add a shared resilience layer for the live distributor price pipeline: a new
`lib/scrapers/resilient.ts` module with per-distributor circuit breaker state,
robust blocked detection (403/429 + Cloudflare markers), plain→browser
escalation, and retry/backoff for transient errors. Both the server
(`server/prices.ts`) and the client fallback (`lib/background-price-check.ts`)
swap their direct `fetchWithParser` calls for `resilientFetch`.

`fetchWithParser` stays in `lib/scrapers/utils.ts` — it is still used by
`lib/scrapers/health.ts` `testAllDistributors` and the per-parser `scrapeX`
helpers (which are only exercised by parser unit tests).

## Behavior (from the approved design)

- `FetchStatus = "ok" | "blocked" | "error" | "skipped"`.
- `resilientFetch` checks the breaker first: if `cooldownUntil > now()` →
  `{ status: "skipped", method: "none" }` with no network call.
- Method order: `useBrowser === true` → `["browser", "plain"]`, else
  `["plain", "browser"]`.
- Transient errors retried up to `maxRetries` (2) with backoff
  `retryBaseMs * attempt` (1s, 2s).
- Plain blocked (403/429/Cloudflare markers) → escalate to browser once.
- Browser blocked → stop (no plain fallback). Browser throws (unavailable) →
  fall back to plain.
- Blocked → breaker `status: "blocked"`, cooldown
  `blockedCooldownMs (30min) × 1.5^(consecutiveFailures-1)` capped at
  `maxCooldownMs (2h)`.
- Transient failures ≥ `failureThreshold` (3) → cooldown `failureCooldownMs`
  (15min).
- Any success resets the breaker (`status: "working"`, `consecutiveFailures: 0`,
  `cooldownUntil: 0`).
- `now()` is injectable for tests.

## Task List

1. **Resilient module — types, classifier, memory breaker store**
2. **Storage-backed breaker store**
3. **`resilientFetch` core (retry + escalation + breaker)**
4. **Server integration** (`server/prices.ts` + `tests/prices.test.ts`, `tests/warmer.test.ts`)
5. **Client integration** (`lib/background-price-check.ts` + `tests/server-first-scrape.test.ts`)
6. **Final verification + checkpoint**

TDD per task: write failing tests → implement → run → commit.

---

## Task 1 — Resilient module: types, classifier, memory breaker store

### Step 1.1: Write failing tests

Create `tests/resilient-fetch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  classifyFetchStatus,
  createMemoryBreakerStore,
  type BreakerEntry,
} from "../lib/scrapers/resilient";

describe("classifyFetchStatus", () => {
  it("classifies 403 and 429 as blocked", () => {
    expect(classifyFetchStatus("<html>hi</html>", 403)).toBe("blocked");
    expect(classifyFetchStatus("<html>hi</html>", 429)).toBe("blocked");
  });

  it("classifies other 4xx/5xx as error", () => {
    expect(classifyFetchStatus("<html>hi</html>", 500)).toBe("error");
    expect(classifyFetchStatus("<html>hi</html>", 404)).toBe("error");
  });

  it("classifies Cloudflare challenge markers as blocked", () => {
    expect(classifyFetchStatus("Checking your browser...")).toBe("blocked");
    expect(classifyFetchStatus("cf-browser-verification")).toBe("blocked");
    expect(classifyFetchStatus("403 Forbidden")).toBe("blocked");
    expect(classifyFetchStatus("Access Denied")).toBe("blocked");
  });

  it("classifies normal HTML as ok", () => {
    expect(classifyFetchStatus("<html>price $50</html>", 200)).toBe("ok");
    expect(classifyFetchStatus("<html>price $50</html>")).toBe("ok");
  });
});

describe("createMemoryBreakerStore", () => {
  it("returns null for unknown distributors", async () => {
    const store = createMemoryBreakerStore();
    expect(await store.get("d1")).toBeNull();
  });

  it("round-trips entries", async () => {
    const store = createMemoryBreakerStore();
    const entry: BreakerEntry = {
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 2,
      lastAttemptAt: 100,
      cooldownUntil: 200,
      reason: "blocked by site",
    };
    await store.set(entry);
    expect(await store.get("d1")).toEqual(entry);
  });
});
```

### Step 1.2: Run → fail

`pnpm test -- tests/resilient-fetch.test.ts` — module does not exist yet.

### Step 1.3: Implement

Create `lib/scrapers/resilient.ts` (types, classifier, memory store only for now):

```ts
import type { StorageAdapter } from "../storage";

export type FetchStatus = "ok" | "blocked" | "error" | "skipped";

export interface FetchOutcome {
  html?: string;
  status: FetchStatus;
  method: "plain" | "browser" | "none";
  error?: string;
}

export interface BreakerEntry {
  distributorId: string;
  status: "working" | "blocked" | "error";
  consecutiveFailures: number;
  lastAttemptAt: number;
  cooldownUntil: number;
  reason?: string;
}

export interface BreakerStateStore {
  get(distributorId: string): Promise<BreakerEntry | null>;
  set(entry: BreakerEntry): Promise<void>;
}

const BLOCKED_MARKERS = [
  "403 Forbidden",
  "Access Denied",
  "cf-browser-verification",
  "Checking your browser",
];

export function classifyFetchStatus(
  html: string,
  httpStatus?: number,
): "ok" | "blocked" | "error" {
  if (httpStatus === 403 || httpStatus === 429) return "blocked";
  if (httpStatus !== undefined && httpStatus >= 400) return "error";
  if (BLOCKED_MARKERS.some((marker) => html.includes(marker))) return "blocked";
  return "ok";
}

export function createMemoryBreakerStore(): BreakerStateStore {
  const entries = new Map<string, BreakerEntry>();
  return {
    async get(distributorId) {
      return entries.get(distributorId) ?? null;
    },
    async set(entry) {
      entries.set(entry.distributorId, entry);
    },
  };
}
```

### Step 1.4: Run → pass

`pnpm test -- tests/resilient-fetch.test.ts`

### Step 1.5: Commit

`Task 1: resilient fetch types, classifier, memory breaker store`

---

## Task 2 — Storage-backed breaker store

### Step 2.1: Write failing tests

Append to `tests/resilient-fetch.test.ts`:

```ts
import { createStorageBreakerStore } from "../lib/scrapers/resilient";

describe("createStorageBreakerStore", () => {
  function makeAdapter() {
    const data = new Map<string, string>();
    return {
      getItem: vi.fn(async (key: string) => data.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        data.set(key, value);
      }),
    };
  }

  it("returns null for unknown distributors", async () => {
    const store = createStorageBreakerStore(makeAdapter());
    expect(await store.get("d1")).toBeNull();
  });

  it("round-trips entries across store instances", async () => {
    const adapter = makeAdapter();
    const store1 = createStorageBreakerStore(adapter);
    const store2 = createStorageBreakerStore(adapter);
    const entry: BreakerEntry = {
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 1,
      lastAttemptAt: 100,
      cooldownUntil: 200,
    };
    await store1.set(entry);
    expect(await store2.get("d1")).toEqual(entry);
  });

  it("keeps multiple distributors independent", async () => {
    const store = createStorageBreakerStore(makeAdapter());
    await store.set({
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 1,
      lastAttemptAt: 0,
      cooldownUntil: 100,
    });
    await store.set({
      distributorId: "d2",
      status: "working",
      consecutiveFailures: 0,
      lastAttemptAt: 0,
      cooldownUntil: 0,
    });
    expect((await store.get("d1"))?.status).toBe("blocked");
    expect((await store.get("d2"))?.status).toBe("working");
  });
});
```

Update the imports at the top of the file to include `vi` and
`createStorageBreakerStore`.

### Step 2.2: Run → fail

`pnpm test -- tests/resilient-fetch.test.ts`

### Step 2.3: Implement

Append to `lib/scrapers/resilient.ts`:

```ts
export function createStorageBreakerStore(
  adapter: Pick<StorageAdapter, "getItem" | "setItem">,
): BreakerStateStore {
  const KEY = "distributor_breaker";

  async function readList(): Promise<BreakerEntry[]> {
    try {
      const raw = await adapter.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BreakerEntry[]) : [];
    } catch {
      return [];
    }
  }

  return {
    async get(distributorId) {
      const list = await readList();
      return list.find((e) => e.distributorId === distributorId) ?? null;
    },
    async set(entry) {
      try {
        const list = await readList();
        const next = list.filter((e) => e.distributorId !== entry.distributorId);
        next.push(entry);
        await adapter.setItem(KEY, JSON.stringify(next));
      } catch {
        // Ignore persistence errors
      }
    },
  };
}
```

### Step 2.4: Run → pass

`pnpm test -- tests/resilient-fetch.test.ts`

### Step 2.5: Commit

`Task 2: storage-backed breaker store`

---

## Task 3 — `resilientFetch` core

### Step 3.1: Write failing tests

Append to `tests/resilient-fetch.test.ts`. Add a `makeParser` helper and the
browser mock at the top of the file:

```ts
import { resilientFetch } from "../lib/scrapers/resilient";
import type { DistributorParser } from "../lib/scrapers/types";

const browserMock = vi.hoisted(() => ({ fetchWithBrowser: vi.fn() }));

vi.mock("../lib/scrapers/browser", () => ({
  fetchWithBrowser: browserMock.fetchWithBrowser,
}));

function makeParser(
  overrides: Partial<DistributorParser> = {},
): DistributorParser {
  return {
    id: "d1",
    baseUrl: "https://example.com",
    buildSearchUrl: (model) => `https://example.com/search?q=${model}`,
    parsePrice: () => null,
    rateLimitMs: 0,
    ...overrides,
  };
}

describe("resilientFetch", () => {
  beforeEach(() => {
    browserMock.fetchWithBrowser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok and records success for a plain fetch", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.html).toBe("<html>price</html>");
    expect(outcome.method).toBe("plain");
    expect(await state.get("d1")).toMatchObject({
      status: "working",
      consecutiveFailures: 0,
    });
  });

  it("escalates to browser when plain is blocked", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockResolvedValue("<html>price</html>");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("browser");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
  });

  it("breaks the circuit on blocked and enters cooldown", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      now: () => 1000,
    });
    expect(outcome.status).toBe("blocked");
    const entry = await state.get("d1");
    expect(entry?.status).toBe("blocked");
    expect(entry?.consecutiveFailures).toBe(1);
    expect(entry?.cooldownUntil).toBe(1000 + 30 * 60 * 1000);
  });

  it("skips when the breaker is in cooldown", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    await state.set({
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 2,
      lastAttemptAt: 0,
      cooldownUntil: 5000,
    });
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      now: () => 1000,
    });
    expect(outcome.status).toBe("skipped");
    expect(outcome.method).toBe("none");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries transient errors then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response("<html>price</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      retryBaseMs: 1,
    });
    expect(outcome.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("enters cooldown after the failure threshold", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const opts = {
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      retryBaseMs: 1,
      failureThreshold: 3,
      failureCooldownMs: 15 * 60 * 1000,
      now: () => 1000,
    };
    await resilientFetch(opts);
    await resilientFetch(opts);
    const third = await resilientFetch(opts);
    expect(third.status).toBe("error");
    const entry = await state.get("d1");
    expect(entry?.consecutiveFailures).toBe(3);
    expect(entry?.cooldownUntil).toBe(1000 + 15 * 60 * 1000);
  });

  it("grows blocked cooldown with consecutive failures", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    let nowValue = 1000;
    const opts = {
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      now: () => nowValue,
    };
    await resilientFetch(opts);
    nowValue = 1000 + 60 * 60 * 1000;
    await resilientFetch(opts);
    const entry = await state.get("d1");
    expect(entry?.consecutiveFailures).toBe(2);
    expect(entry?.cooldownUntil).toBe(
      nowValue + Math.round(30 * 60 * 1000 * 1.5),
    );
  });

  it("uses browser first for useBrowser parsers", async () => {
    browserMock.fetchWithBrowser.mockResolvedValue("<html>price</html>");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { headless: true } }),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("browser");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to plain when browser is blocked", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockResolvedValue("403 Forbidden");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { headless: true } }),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to plain when browser is unavailable", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockRejectedValue(
      new Error("browser not available"),
    );
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { headless: true } }),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("plain");
  });
});
```

### Step 3.2: Run → fail

`pnpm test -- tests/resilient-fetch.test.ts`

### Step 3.3: Implement

Append the rest of `lib/scrapers/resilient.ts`:

```ts
import { getRandomUserAgent } from "./utils";
import type { DistributorParser } from "./types";

export interface ResilientFetchOptions {
  parser: DistributorParser;
  url: string;
  state: BreakerStateStore;
  now?: () => number;
  maxRetries?: number;
  retryBaseMs?: number;
  blockedCooldownMs?: number;
  failureCooldownMs?: number;
  failureThreshold?: number;
  maxCooldownMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlain(
  url: string,
  rateLimitMs: number,
): Promise<{ html: string; status: number }> {
  await sleep(rateLimitMs);
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
    },
  });
  const html = await response.text();
  return { html, status: response.status };
}

async function fetchBrowser(
  parser: DistributorParser,
  url: string,
): Promise<string> {
  const { fetchWithBrowser } = await import("./browser");
  return fetchWithBrowser(url, parser.browserOptions);
}

function blockCooldownMs(
  baseMs: number,
  consecutiveFailures: number,
  maxMs: number,
): number {
  const growth = Math.pow(1.5, consecutiveFailures - 1);
  return Math.min(Math.round(baseMs * growth), maxMs);
}

async function recordSuccess(
  state: BreakerStateStore,
  distributorId: string,
  now: number,
): Promise<void> {
  await state.set({
    distributorId,
    status: "working",
    consecutiveFailures: 0,
    lastAttemptAt: now,
    cooldownUntil: 0,
  });
}

async function attemptMethod(
  method: "plain" | "browser",
  opts: ResilientFetchOptions,
  maxRetries: number,
  retryBaseMs: number,
): Promise<FetchOutcome> {
  let last: FetchOutcome = {
    status: "error",
    method,
    error: "no attempt made",
  };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(retryBaseMs * attempt);
    try {
      if (method === "browser") {
        const html = await fetchBrowser(opts.parser, opts.url);
        const status = classifyFetchStatus(html);
        if (status === "ok") return { html, status: "ok", method };
        last = { status, method, error: "blocked by site" };
        break;
      }
      const { html, status: httpStatus } = await fetchPlain(
        opts.url,
        opts.parser.rateLimitMs,
      );
      const status = classifyFetchStatus(html, httpStatus);
      if (status === "ok") return { html, status: "ok", method };
      last = {
        status,
        method,
        error: status === "blocked" ? "blocked by site" : `HTTP ${httpStatus}`,
      };
      if (status === "blocked") break;
    } catch (error) {
      last = {
        status: "error",
        method,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return last;
}

export async function resilientFetch(
  opts: ResilientFetchOptions,
): Promise<FetchOutcome> {
  const now = opts.now ?? Date.now;
  const maxRetries = opts.maxRetries ?? 2;
  const retryBaseMs = opts.retryBaseMs ?? 1000;
  const blockedCooldownMs = opts.blockedCooldownMs ?? 30 * 60 * 1000;
  const failureCooldownMs = opts.failureCooldownMs ?? 15 * 60 * 1000;
  const failureThreshold = opts.failureThreshold ?? 3;
  const maxCooldownMs = opts.maxCooldownMs ?? 2 * 60 * 60 * 1000;

  const entry = (await opts.state.get(opts.parser.id)) ?? {
    distributorId: opts.parser.id,
    status: "working" as const,
    consecutiveFailures: 0,
    lastAttemptAt: 0,
    cooldownUntil: 0,
  };

  if (entry.cooldownUntil > now()) {
    return { status: "skipped", method: "none" };
  }

  const methods: Array<"plain" | "browser"> =
    opts.parser.useBrowser === true
      ? ["browser", "plain"]
      : ["plain", "browser"];

  let lastOutcome: FetchOutcome = {
    status: "error",
    method: "none",
    error: "no attempt made",
  };

  for (const method of methods) {
    const outcome = await attemptMethod(method, opts, maxRetries, retryBaseMs);
    lastOutcome = outcome;
    if (outcome.status === "ok") {
      await recordSuccess(opts.state, opts.parser.id, now());
      return outcome;
    }
    if (outcome.status === "blocked") {
      if (method === "plain") continue;
      break;
    }
    if (method === "browser") continue;
    break;
  }

  const isBlocked = lastOutcome.status === "blocked";
  const next: BreakerEntry = {
    ...entry,
    status: isBlocked ? "blocked" : "error",
    consecutiveFailures: entry.consecutiveFailures + 1,
    lastAttemptAt: now(),
    reason: lastOutcome.error,
  };
  if (isBlocked) {
    next.cooldownUntil =
      now() +
      blockCooldownMs(blockedCooldownMs, next.consecutiveFailures, maxCooldownMs);
  } else if (next.consecutiveFailures >= failureThreshold) {
    next.cooldownUntil = now() + failureCooldownMs;
  }
  await opts.state.set(next);
  return lastOutcome;
}
```

### Step 3.4: Run → pass

`pnpm test -- tests/resilient-fetch.test.ts`

### Step 3.5: Full suite + typecheck

`pnpm test` and `pnpm check`.

### Step 3.6: Commit

`Task 3: resilientFetch with retry, escalation, and circuit breaker`

---

## Task 4 — Server integration

### Step 4.1: Update `server/prices.ts`

Replace the import:

```ts
import { fetchWithParser } from "../lib/scrapers/utils";
```

with:

```ts
import {
  createMemoryBreakerStore,
  resilientFetch,
} from "../lib/scrapers/resilient";
```

Add a module-scope breaker store near the other module constants (e.g. next to
`const inFlight`):

```ts
const breakerStore = createMemoryBreakerStore();
```

Replace the body of `refreshPrice`:

```ts
async function refreshPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  try {
    const url = parser.buildSearchUrl(modelNumber);
    const outcome = await resilientFetch({ parser, url, state: breakerStore });
    if (outcome.status !== "ok" || !outcome.html) return null;
    const result = parser.parsePrice(outcome.html);
    if (!result) return null;
    const snapshot: PriceSnapshot = { ...result, fetchedAt: Date.now() };
    await setCachedPrice(distributorId, modelNumber, snapshot);
    await recordHistoryPoint(distributorId, modelNumber, snapshot);
    return snapshot;
  } catch (error) {
    console.warn(
      `[Prices] Scrape failed for ${distributorId}/${modelNumber}:`,
      error,
    );
    return null;
  }
}
```

### Step 4.2: Update `tests/prices.test.ts`

Replace the utils mock:

```ts
vi.mock("../lib/scrapers/utils", () => ({
  fetchWithParser: vi.fn(),
}));
```

with:

```ts
vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(),
  createMemoryBreakerStore: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  })),
}));
```

Replace the import and mock binding:

```ts
import { fetchWithParser } from "../lib/scrapers/utils";
const mockedFetch = vi.mocked(fetchWithParser);
```

with:

```ts
import { resilientFetch } from "../lib/scrapers/resilient";
const mockedFetch = vi.mocked(resilientFetch);
```

Replace all `mockedFetch.mockResolvedValue("<html>price</html>")` occurrences
(lines 127, 140, 170, 190) with:

```ts
mockedFetch.mockResolvedValue({
  status: "ok",
  html: "<html>price</html>",
  method: "plain",
});
```

Replace `mockedFetch.mockRejectedValue(new Error("network down"))` (line 153)
with:

```ts
mockedFetch.mockResolvedValue({
  status: "error",
  method: "plain",
  error: "network down",
});
```

The `toHaveBeenCalled`/`not.toHaveBeenCalled`/`toHaveBeenCalledTimes(3)`
assertions stay the same (they now assert on `resilientFetch`).

### Step 4.3: Update `tests/warmer.test.ts`

Same three changes as `tests/prices.test.ts`:
- Mock `../lib/scrapers/resilient` with `resilientFetch` +
  `createMemoryBreakerStore` (valid store object).
- Import `resilientFetch` instead of `fetchWithParser`; rebind `mockedFetch`.
- `mockedFetch.mockResolvedValue("<html>price</html>")` (line 51) →
  `mockedFetch.mockResolvedValue({ status: "ok", html: "<html>price</html>", method: "plain" })`.

Assertions at lines 60, 76 (`toHaveBeenCalledTimes(1)`, `not.toHaveBeenCalled`,
`toHaveBeenCalledTimes(2)`) stay the same.

### Step 4.4: Run → pass

`pnpm test -- tests/prices.test.ts tests/warmer.test.ts`

### Step 4.5: Full suite + typecheck

`pnpm test` and `pnpm check`.

### Step 4.6: Commit

`Task 4: server prices use resilientFetch`

---

## Task 5 — Client integration

### Step 5.1: Update `lib/background-price-check.ts`

Replace the import:

```ts
import { fetchWithParser } from "./scrapers/utils";
```

with:

```ts
import {
  createStorageBreakerStore,
  resilientFetch,
} from "./scrapers/resilient";
```

Add a module-scope breaker store next to `healthService`:

```ts
const breakerStore = createStorageBreakerStore(AsyncStorage);
```

Replace the local-fallback block in `refreshListing` (currently lines
~110–160, from `const parser = getParserByDistributorId(...)` through the end
of the `try/catch`) with:

```ts
  const parser = getParserByDistributorId(listing.distributorId);
  if (!parser) return listing;

  const url = parser.buildSearchUrl(product.modelNumber);
  const outcome = await resilientFetch({ parser, url, state: breakerStore });

  if (outcome.status !== "ok" || !outcome.html) {
    if (outcome.status === "blocked") {
      healthCollector.record(parser.id, "blocked", outcome.error ?? "blocked by site");
    } else if (outcome.status === "skipped") {
      healthCollector.record(parser.id, "blocked", "in cooldown");
    } else {
      healthCollector.record(parser.id, "error", outcome.error ?? "no price found");
    }
    return listing;
  }

  try {
    const result = parser.parsePrice(outcome.html);
    if (!result) {
      healthCollector.record(parser.id, "error", "no price found");
      return listing;
    }
    healthCollector.record(parser.id, "working");
    const now = new Date().toISOString();
    const newPricePoint: PricePoint = {
      date: now,
      price: result.price,
      currency: result.currency,
      stockStatus: result.stockStatus,
    };
    return {
      ...listing,
      price: result.price,
      currency: result.currency,
      stockStatus: result.stockStatus,
      expectedDate: result.expectedDate,
      url: result.url,
      lastChecked: now,
      priceHistory: appendPricePoint(
        listing.priceHistory,
        newPricePoint,
        PRICE_HISTORY_DAYS,
      ),
    };
  } catch (error) {
    healthCollector.record(
      parser.id,
      "error",
      error instanceof Error ? error.message : String(error),
    );
    return listing;
  }
```

Note: the old `html.includes(...)` Cloudflare-marker branch is removed — the
blocked classification now lives in `classifyFetchStatus` inside
`resilientFetch`.

### Step 5.2: Update `tests/server-first-scrape.test.ts`

Replace the utils mock:

```ts
vi.mock("../lib/scrapers/utils", () => ({
  fetchWithParser: vi.fn(),
}));
```

with:

```ts
vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(),
  createStorageBreakerStore: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  })),
}));
```

Replace the import and mock binding:

```ts
import { fetchWithParser } from "../lib/scrapers/utils";
const mockedFetchLocal = vi.mocked(fetchWithParser);
```

with:

```ts
import { resilientFetch } from "../lib/scrapers/resilient";
const mockedFetchLocal = vi.mocked(resilientFetch);
```

Replace line 156:

```ts
mockedFetchLocal.mockResolvedValue("<html>price</html>");
```

with:

```ts
mockedFetchLocal.mockResolvedValue({
  status: "ok",
  html: "<html>price</html>",
  method: "plain",
});
```

Replace line 175:

```ts
mockedFetchLocal.mockResolvedValue("<html>no price</html>");
```

with:

```ts
mockedFetchLocal.mockResolvedValue({
  status: "ok",
  html: "<html>no price</html>",
  method: "plain",
});
```

`tests/price-check.test.ts` needs **no changes** — it mocks
`getParserByDistributorId` to return `undefined`, so `refreshListing` returns
early before `resilientFetch` is ever called, and the module-scope
`createStorageBreakerStore(AsyncStorage)` only wraps AsyncStorage without
invoking adapter methods at import time.

### Step 5.3: Run → pass

`pnpm test -- tests/server-first-scrape.test.ts tests/price-check.test.ts`

### Step 5.4: Full suite + typecheck + lint

`pnpm test`, `pnpm check`, `pnpm lint`.

### Step 5.5: Commit

`Task 5: client background price check uses resilientFetch`

---

## Task 6 — Final verification + checkpoint

1. `pnpm check` — 0 TypeScript errors.
2. `pnpm lint` — clean.
3. `pnpm test` — 609 pass / 9 skip (no DB flag).
4. `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm test` — 618 pass.
5. Update `todo.md` with a Phase 47 entry for the resilient parser fetch feature.
6. Commit: `Checkpoint: v4.7: Resilient parser fetch with circuit breaker, plain→browser escalation, and blocked detection. TypeScript: 0 errors.`

## Verification Checklist (from design §6)

- [x] Retry/backoff: transient errors retried up to 2× with 1s/2s backoff.
- [x] Escalation: plain blocked → browser; browser blocked → no plain fallback; browser unavailable → plain fallback.
- [x] Cooldown/skip: in-cooldown requests return `skipped` with no network call.
- [x] Re-probe: after cooldown expires, next request attempts again.
- [x] Threshold: 3 consecutive transient failures → 15min cooldown.
- [x] Blocked detection: 403/429 + Cloudflare markers.
- [x] Both stores: memory (server) and storage-backed (client) round-trip.
- [x] Integration: `server/prices.ts` and `lib/background-price-check.ts` both route through `resilientFetch`.