# Managed Scraping-Provider Fallback (server-only) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the browser path is blocked by Cloudflare, let the server fall back to a managed scraping API (env-configured URL template) that returns rendered HTML — spend-capped and inert when unconfigured.

**Architecture:** `lib/scrapers/resilient.ts` gains a `setProviderFetcher` injection hook and a `provider` method tried only after a block. `server/scrapers/provider.ts` (server-only) registers a fetcher built from `SCRAPING_PROVIDER_*` env, gated by the existing spend budget. Mobile never registers one, so the method is a no-op there.

**Tech Stack:** Node/TS, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-scraping-provider-fallback-design.md`

---

## File Structure

- Modify `lib/scrapers/resilient.ts` — hook + `provider` method.
- Create `server/scrapers/provider.ts` — the env-configured fetcher + `registerScrapingProvider`.
- Modify `server/spend-budget.ts` — the `scraping.provider` budget.
- Modify `server/_core/index.ts` — register at boot.
- Tests: `tests/scrapers/provider-fallback.test.ts`, `tests/server-scraping-provider.test.ts`, `tests/scrapers/provider-guard.test.ts`.

---

### Task 1: Injection hook + `provider` method

**Files:** Modify `lib/scrapers/resilient.ts`; Test `tests/scrapers/provider-fallback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/provider-fallback.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// The browser method would launch Chromium; make it unavailable so the only
// remaining path is plain (blocked) -> provider.
vi.mock("@/lib/scrapers/browser", () => ({
  fetchWithBrowser: async () => {
    throw new Error("browser unavailable in test");
  },
}));

import {
  resilientFetch,
  setProviderFetcher,
  createMemoryBreakerStore,
} from "@/lib/scrapers/resilient";

const parser = {
  id: "blocked-us",
  baseUrl: "https://blocked.test",
  buildSearchUrl: (m: string) => `https://blocked.test/search?q=${m}`,
  parsePrice: () => ({ price: 42, currency: "USD", stockStatus: "in_stock", url: "" }),
  useBrowser: false,
  rateLimitMs: 0,
} as never;

describe("provider fallback", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => setProviderFetcher(null));
  afterEach(() => {
    setProviderFetcher(null);
    globalThis.fetch = realFetch;
  });

  it("is not used when no fetcher is registered", async () => {
    globalThis.fetch = vi.fn(async () => new Response("Just a moment", { status: 403 })) as never;
    const outcome = await resilientFetch({
      parser,
      url: parser.buildSearchUrl("X"),
      state: createMemoryBreakerStore(),
    });
    expect(outcome.status).toBe("blocked");
  });

  it("is tried after a block and returns ok", async () => {
    globalThis.fetch = vi.fn(async () => new Response("Just a moment", { status: 403 })) as never;
    setProviderFetcher(async () => "<html><span class='price'>$42.00</span></html>");
    const outcome = await resilientFetch({
      parser,
      url: parser.buildSearchUrl("X"),
      state: createMemoryBreakerStore(),
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("provider");
  });

  it("is not tried when the plain fetch already succeeds", async () => {
    globalThis.fetch = vi.fn(async () => new Response("<html>ok</html>", { status: 200 })) as never;
    const provider = vi.fn(async () => "<html>provider</html>");
    setProviderFetcher(provider);
    const outcome = await resilientFetch({
      parser,
      url: parser.buildSearchUrl("X"),
      state: createMemoryBreakerStore(),
    });
    expect(outcome.status).toBe("ok");
    expect(provider).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/provider-fallback.test.ts`
Expected: FAIL — `setProviderFetcher` is not exported.

- [ ] **Step 3: Add the hook and method**

In `lib/scrapers/resilient.ts`, extend `FetchOutcome.method`:

```ts
export interface FetchOutcome {
  html?: string;
  status: FetchStatus;
  method: "plain" | "browser" | "provider" | "none";
  error?: string;
}
```

Add the hook near the top (after the imports):

```ts
export type ProviderFetcher = (url: string) => Promise<string | null>;
let providerFetcher: ProviderFetcher | null = null;
export function setProviderFetcher(fn: ProviderFetcher | null): void {
  providerFetcher = fn;
}
export function getProviderFetcher(): ProviderFetcher | null {
  return providerFetcher;
}

async function attemptProvider(opts: ResilientFetchOptions): Promise<FetchOutcome> {
  const fetcher = providerFetcher;
  if (!fetcher) return { status: "error", method: "none", error: "no provider" };
  try {
    const html = await fetcher(opts.url);
    if (!html) return { status: "error", method: "provider", error: "provider returned nothing" };
    const status = classifyFetchStatus(html);
    if (status === "ok") return { html, status: "ok", method: "provider" };
    return { status, method: "provider", error: "provider blocked" };
  } catch (error) {
    return {
      status: "error",
      method: "provider",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

In `runResilientFetch`, after the `for (const method of methods)` loop and the `if (blockedOutcome) lastOutcome = blockedOutcome;` line, insert:

```ts
  // A managed provider is the last resort for a genuine block, and only when
  // one is registered (server-only). It is never tried on a plain success.
  if (blockedOutcome && providerFetcher) {
    const outcome = await attemptProvider(opts);
    if (outcome.status === "ok") {
      await recordSuccess(opts.state, opts.parser.id, now());
      return outcome;
    }
    lastOutcome = outcome;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/provider-fallback.test.ts tests/scrapers/resilient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/resilient.ts tests/scrapers/provider-fallback.test.ts
git commit -m "feat(scrapers): provider fallback hook tried only after a block"
```

---

### Task 2: Server provider fetcher

**Files:** Create `server/scrapers/provider.ts`; Modify `server/spend-budget.ts`; Test `tests/server-scraping-provider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server-scraping-provider.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { registerScrapingProvider } from "@/server/scrapers/provider";
import { getProviderFetcher, setProviderFetcher } from "@/lib/scrapers/resilient";

describe("registerScrapingProvider", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    setProviderFetcher(null);
    globalThis.fetch = realFetch;
    delete process.env.SCRAPING_PROVIDER_URL;
    delete process.env.SCRAPING_PROVIDER_API_KEY;
  });

  it("does not register when the URL template is unset", () => {
    expect(registerScrapingProvider()).toBe(false);
    expect(getProviderFetcher()).toBeNull();
  });

  it("registers a fetcher that interpolates the URL and sends the key", async () => {
    process.env.SCRAPING_PROVIDER_URL = "https://api.example.com/?key=K&url={url}";
    process.env.SCRAPING_PROVIDER_API_KEY = "secret";
    const fetchMock = vi.fn(async () => new Response("<html>rendered</html>", { status: 200 }));
    globalThis.fetch = fetchMock as never;
    expect(registerScrapingProvider()).toBe(true);
    const html = await getProviderFetcher()!("https://shop.test/search?q=CRS326");
    expect(html).toBe("<html>rendered</html>");
    const called = fetchMock.mock.calls[0][0] as string;
    expect(called).toContain("url=https%3A%2F%2Fshop.test%2Fsearch%3Fq%3DCRS326");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("returns null on a non-2xx provider response", async () => {
    process.env.SCRAPING_PROVIDER_URL = "https://api.example.com/?url={url}";
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as never;
    registerScrapingProvider();
    expect(await getProviderFetcher()!("https://shop.test/x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/server-scraping-provider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the budget and the fetcher**

In `server/spend-budget.ts`, add to `BUDGETS`:
```ts
  "scraping.provider": { name: "scraping.provider", limit: envLimit("scraping.provider", 100), windowMs: 60 * 60 * 1000 },
```

Create `server/scrapers/provider.ts`:
```ts
// Server-only managed scraping-provider fallback. Configured entirely by env:
//   SCRAPING_PROVIDER_URL        URL template containing {url}
//   SCRAPING_PROVIDER_API_KEY    optional bearer token
//   SCRAPING_PROVIDER_KEY_HEADER optional header name (default Authorization)
// Unset URL => no fetcher registered => the provider method is unavailable.
import { setProviderFetcher } from "../../lib/scrapers/resilient";
import { tryConsumeBudget } from "../spend-budget";

export function registerScrapingProvider(): boolean {
  const template = process.env.SCRAPING_PROVIDER_URL;
  if (!template) {
    setProviderFetcher(null);
    return false;
  }
  const key = process.env.SCRAPING_PROVIDER_API_KEY;
  const keyHeader = process.env.SCRAPING_PROVIDER_KEY_HEADER ?? "Authorization";

  setProviderFetcher(async (url: string): Promise<string | null> => {
    if (!tryConsumeBudget("scraping.provider")) return null;
    const target = template.replace("{url}", encodeURIComponent(url));
    const headers: Record<string, string> = {};
    if (key) headers[keyHeader] = keyHeader === "Authorization" ? `Bearer ${key}` : key;
    try {
      const res = await fetch(target, { headers });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  });
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/server-scraping-provider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/scrapers/provider.ts server/spend-budget.ts tests/server-scraping-provider.test.ts
git commit -m "feat(server): env-configured managed scraping-provider fetcher"
```

---

### Task 3: Register at server boot

**Files:** Modify `server/_core/index.ts`

- [ ] **Step 1: Register once at boot**

Add the import:
```ts
import { registerScrapingProvider } from "../scrapers/provider";
```

Call it once during startup (near the other boot wiring, e.g. before `registerSpa(app)`):
```ts
  registerScrapingProvider();
```

- [ ] **Step 2: Verify**

Run: `pnpm check && pnpm exec vitest run tests/server-scraping-provider.test.ts`
Expected: 0 type errors; tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/_core/index.ts
git commit -m "feat(server): register the scraping provider at boot"
```

---

### Task 4: Guard + full verification + docs

**Files:** Create `tests/scrapers/provider-guard.test.ts`; `todo.md`

- [ ] **Step 1: Write the guard**

```ts
// tests/scrapers/provider-guard.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("scraping provider is server-only", () => {
  it("only server/scrapers/provider.ts reads SCRAPING_PROVIDER_*", () => {
    const root = path.resolve(__dirname, "../..");
    const offenders: string[] = [];
    for (const dir of ["lib", "app", "components", "hooks", "shared", "server"]) {
      for (const file of walk(path.join(root, dir))) {
        const rel = path.relative(root, file);
        if (rel === "server/scrapers/provider.ts") continue;
        if (/SCRAPING_PROVIDER_/.test(readFileSync(file, "utf-8"))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard + full gate**

Run: `pnpm exec vitest run tests/scrapers/provider-guard.test.ts && pnpm check && pnpm lint && pnpm verify`
Expected: guard passes; `pnpm verify` green.

- [ ] **Step 3: Document**

Add a `todo.md` phase entry (next number 1105): the provider fallback, the env config, the block-only + budget gating, and the note that the live gain is only measurable against real targets with a provider key. Commit `docs: managed scraping-provider fallback (Phase 1105)`.

---

## Self-Review

- **Spec coverage:** hook + provider method (Task 1), server fetcher + budget (Task 2), boot registration (Task 3), guard + verify + docs (Task 4). Mobile/web/desktop and vendor SDKs are out of scope.
- **Placeholders:** none.
- **Type consistency:** `ProviderFetcher = (url) => Promise<string | null>`; `setProviderFetcher`/`getProviderFetcher`; `FetchOutcome.method` includes `"provider"`; `registerScrapingProvider(): boolean`; `tryConsumeBudget("scraping.provider")` — used consistently.
