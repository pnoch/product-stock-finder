# Optional Server / Android Standalone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the companion server fully optional — an Android build without `EXPO_PUBLIC_API_BASE_URL` gets live prices via on-device scraping plus all local features, while a configured server keeps today's behavior with an added per-listing device-scrape fallback.

**Architecture:** An availability gate (`isServerConfigured()`) drives everything: a shared `resolvePrice` helper layers device scraping under the server query for foreground/discovery paths, Metro redirects the Playwright-dependent `browser.ts` to its native stub on ios/android, startup skips doomed server calls, and Settings/connection UI renders a local-only state when unconfigured.

**Tech Stack:** Expo SDK 54 / RN 0.81, tRPC v11 client, cheerio-based parsers via `resilientFetch`, Metro custom resolver, vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-optional-server-design.md`

**Spec erratum (fixed in Task 7's commit):** the spec says `checkPriceDropsNow` adopts `resolvePrice`; in reality `price-check.ts` delegates entirely to `refreshListing` (`lib/background-tasks/price-check.ts:43`), which already implements the hybrid pattern manually — no change needed there.

---

### Task 1: Availability gate + config hook

**Files:**
- Modify: `constants/oauth.ts` (after `getApiBaseUrl`, ~line 52)
- Create: `hooks/use-server-config.ts`

- [ ] **Step 1: Add the gate**

In `constants/oauth.ts`, directly after the `getApiBaseUrl()` function (ends ~line 52 with `return "";` + `}`), add:

```ts
/**
 * True when a companion API server is configured. Native builds without
 * EXPO_PUBLIC_API_BASE_URL and static web deploys return "" from
 * getApiBaseUrl(), meaning the app runs in local-only mode.
 */
export function isServerConfigured(): boolean {
  return getApiBaseUrl() !== "";
}
```

- [ ] **Step 2: Add the hook**

Create `hooks/use-server-config.ts`:

```ts
import { useMemo } from "react";
import { isServerConfigured } from "@/constants/oauth";

export function useServerConfig(): { configured: boolean } {
  const configured = useMemo(() => isServerConfigured(), []);
  return { configured };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add constants/oauth.ts hooks/use-server-config.ts
git commit -m "feat: add isServerConfigured gate and useServerConfig hook"
```

---

### Task 2: `lib/price-source.ts` resolver (TDD)

**Files:**
- Create: `lib/price-source.ts`
- Test: `tests/price-source.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/price-source.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  serverResult: null as unknown,
  scrapeResult: null as unknown,
}));

vi.mock("../constants/oauth", () => ({
  isServerConfigured: vi.fn(() => state.configured),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(async () => state.serverResult),
}));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn((id: string) =>
    id === "none"
      ? undefined
      : {
          id,
          buildSearchUrl: (m: string) => `https://x.test/?q=${encodeURIComponent(m)}`,
          parsePrice: vi.fn(() => state.scrapeResult),
          rateLimitMs: 0,
        },
  ),
}));

vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(async () => ({
    status: state.scrapeResult === "BLOCKED" ? "blocked" : "ok",
    html: state.scrapeResult ? "<html>ok</html>" : "",
  })),
  createMemoryBreakerStore: vi.fn(() => ({})),
}));

import { resolvePrice, scrapePriceOnDevice } from "../lib/price-source";

describe("resolvePrice", () => {
  beforeEach(() => {
    state.configured = true;
    state.serverResult = null;
    state.scrapeResult = null;
  });

  it("returns the server result with source=server on hit", async () => {
    state.serverResult = {
      snapshot: { price: 200, currency: "USD", stockStatus: "in_stock", fetchedAt: 1 },
      history: [],
    };
    const r = await resolvePrice("linitx-uk", "CRS326");
    expect(r?.source).toBe("server");
    expect(r?.snapshot?.price).toBe(200);
  });

  it("falls back to device scrape when the server misses", async () => {
    state.scrapeResult = { price: 199, currency: "USD", stockStatus: "in_stock" };
    const r = await resolvePrice("linitx-uk", "CRS326");
    expect(r?.source).toBe("device");
    expect(r?.snapshot?.price).toBe(199);
    expect(r?.snapshot?.fetchedAt).toBeGreaterThan(0);
    expect(r?.history).toEqual([]);
  });

  it("skips the server leg entirely when unconfigured", async () => {
    state.configured = false;
    state.scrapeResult = { price: 199, currency: "USD", stockStatus: "in_stock" };
    const { fetchServerPrice } = await import("../lib/server-prices");
    await resolvePrice("linitx-uk", "CRS326");
    expect(fetchServerPrice).not.toHaveBeenCalled();
  });

  it("returns null when no parser exists", async () => {
    expect(await resolvePrice("none", "CRS326")).toBeNull();
  });

  it("returns null when the device scrape fails", async () => {
    state.scrapeResult = null;
    expect(await resolvePrice("linitx-uk", "CRS326")).toBeNull();
  });

  it("returns null when blocked", async () => {
    state.scrapeResult = "BLOCKED";
    expect(await resolvePrice("linitx-uk", "CRS326")).toBeNull();
  });
});

describe("scrapePriceOnDevice", () => {
  beforeEach(() => {
    state.scrapeResult = null;
  });

  it("threads the model into parsePrice", async () => {
    state.scrapeResult = { price: 10, currency: "GBP", stockStatus: "in_stock" };
    const r = await scrapePriceOnDevice("linitx-uk", "CRS804-4DDQ-hRM");
    expect(r?.source).toBe("device");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/price-source.test.ts`
Expected: FAIL — `../lib/price-source` does not exist.

- [ ] **Step 3: Implement the resolver**

Create `lib/price-source.ts`:

```ts
import { isServerConfigured } from "@/constants/oauth";
import { fetchServerPrice } from "@/lib/server-prices";
import { getParserByDistributorId } from "@/lib/scrapers/registry";
import {
  createMemoryBreakerStore,
  resilientFetch,
} from "@/lib/scrapers/resilient";
import type { ServerPriceResult } from "@/lib/types";

export interface ResolvedPrice extends ServerPriceResult {
  source: "server" | "device";
}

const breakerStore = createMemoryBreakerStore();

export async function scrapePriceOnDevice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  try {
    const url = parser.buildSearchUrl(modelNumber);
    const outcome = await resilientFetch({ parser, url, state: breakerStore });
    if (outcome.status !== "ok" || !outcome.html) return null;
    const result = parser.parsePrice(outcome.html, modelNumber);
    if (!result) return null;
    return {
      snapshot: { ...result, fetchedAt: Date.now() },
      history: [],
      source: "device",
    };
  } catch {
    return null;
  }
}

export async function resolvePrice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null> {
  if (isServerConfigured()) {
    const server = await fetchServerPrice(distributorId, modelNumber);
    if (server) return { ...server, source: "server" };
  }
  return scrapePriceOnDevice(distributorId, modelNumber);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/price-source.test.ts`
Expected: PASS — all six + one cases.

- [ ] **Step 5: Commit**

```bash
git add lib/price-source.ts tests/price-source.test.ts
git commit -m "feat: add hybrid price resolver with on-device scrape fallback"
```

---

### Task 3: Wire foreground + discovery consumers

No commit risk: existing suites mock `../lib/server-prices`, which `price-source` imports internally, so their mocks keep working.

**Files:**
- Modify: `lib/live-prices.ts` (imports ~line 3; `deriveListingQueries` ~line 72)
- Modify: `lib/listing-discovery.ts` (~lines 1, 15, 34)

- [ ] **Step 1: Switch the foreground query source**

In `lib/live-prices.ts`, replace:

```ts
import { fetchServerPrice } from "@/lib/server-prices";
```

with:

```ts
import { resolvePrice } from "@/lib/price-source";
```

and in `deriveListingQueries`, replace:

```ts
    queryFn: () => fetchServerPrice(listing.distributorId, modelNumber),
```

with:

```ts
    queryFn: () => resolvePrice(listing.distributorId, modelNumber),
```

(`applyServerPrice` consumes `.snapshot`/`.history`, which `ResolvedPrice` preserves.)

- [ ] **Step 2: Switch discovery's default**

In `lib/listing-discovery.ts`, replace:

```ts
import { fetchServerPrice } from "./server-prices";
```

with:

```ts
import { resolvePrice } from "./price-source";
```

replace:

```ts
type FetchPrice = typeof fetchServerPrice;
```

with:

```ts
type FetchPrice = typeof resolvePrice;
```

and replace:

```ts
    fetchPrice = fetchServerPrice,
```

with:

```ts
    fetchPrice = resolvePrice,
```

(Discovery reads `.snapshot` off results — shape-compatible.)

- [ ] **Step 3: Run affected suites**

Run: `pnpm vitest run tests/live-prices.test.ts tests/use-live-prices.test.tsx tests/listing-discovery.test.ts tests/server-first-scrape.test.ts`
Expected: PASS. If a suite asserts `fetchServerPrice` was called directly from these modules, re-point that assertion at the resolver boundary (the server-prices mock still intercepts the inner call).

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/live-prices.ts lib/listing-discovery.ts
git commit -m "feat: foreground prices and discovery use hybrid resolver"
```

---

### Task 4: Metro native stub for `browser.ts`

**Files:**
- Create: `scripts/metro-resolver.js`
- Modify: `metro.config.js`
- Test: `tests/metro-resolver.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/metro-resolver.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  resolveBrowserModulePath,
  BROWSER_STUB_PATH,
} from "../scripts/metro-resolver";

describe("resolveBrowserModulePath", () => {
  const request = "/repo/lib/scrapers/browser";

  it("redirects browser.ts to the web stub on android", () => {
    expect(resolveBrowserModulePath("android", request)).toBe(BROWSER_STUB_PATH);
  });

  it("redirects browser.ts to the web stub on ios", () => {
    expect(resolveBrowserModulePath("ios", request)).toBe(BROWSER_STUB_PATH);
  });

  it("leaves web alone", () => {
    expect(resolveBrowserModulePath("web", request)).toBeNull();
  });

  it("ignores unrelated requests on native", () => {
    expect(
      resolveBrowserModulePath("android", "/repo/lib/scrapers/utils"),
    ).toBeNull();
  });

  it("matches the real dynamic import specifier", () => {
    expect(
      resolveBrowserModulePath(
        "android",
        "/repo/lib/scrapers/browser.ts",
      ),
    ).toBe(BROWSER_STUB_PATH);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/metro-resolver.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helper**

Create `scripts/metro-resolver.js`:

```js
/**
 * Pure helper used by metro.config.js: on native platforms, redirect requests
 * for lib/scrapers/browser(.ts) to the playwright-free browser.web.ts stub so
 * Playwright never enters Android/iOS bundles.
 */

const STUB_PATH = "browser.web";

function isBrowserModule(request) {
  const normalized = request.replace(/\.ts$/, "").replace(/\.js$/, "");
  return (
    normalized.endsWith("/scrapers/browser") || normalized === "browser"
  );
}

function resolveBrowserModulePath(platform, request) {
  if (platform !== "ios" && platform !== "android") return null;
  if (!isBrowserModule(request)) return null;
  return require("path").join(__dirname, "..", "lib", "scrapers", `${STUB_PATH}.ts`);
}

module.exports.BROWSER_STUB_PATH = require("path").join(
  __dirname,
  "..",
  "lib",
  "scrapers",
  `${STUB_PATH}.ts`,
);
module.exports.resolveBrowserModulePath = resolveBrowserModulePath;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/metro-resolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into Metro**

In `metro.config.js`, replace the whole file with:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { resolveBrowserModulePath } = require("./scripts/metro-resolver");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const redirected = resolveBrowserModulePath(platform, moduleName);
  if (redirected) {
    return { type: "sourceFile", filePath: redirected };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
```

Note: the helper matches the *specifier* `./browser` used by `fetchWithParser`
(`lib/scrapers/utils.ts:91`) because Metro passes unresolved specifiers through
`resolveRequest` with `context.originModulePath` adjacent to it — the
`endsWith("/scrapers/browser")` arm covers absolute forms and the `=== "browser"`
arm covers the relative specifier.

- [ ] **Step 6: Verify web bundle unaffected**

Run: `pnpm check && pnpm vitest run tests/browser-web.test.ts`
Expected: 0 errors; browser-web surface-parity suite PASSES.

- [ ] **Step 7: Commit**

```bash
git add scripts/metro-resolver.js metro.config.js tests/metro-resolver.test.ts
git commit -m "feat: keep playwright out of native bundles via metro resolver"
```

---

### Task 5: Startup gating in `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx` (notification effect ~lines 140-150; sync setup ~lines 249-262; authenticated effect ~277-283; fx effect ~301-305)

- [ ] **Step 1: Import the gate**

Add to the imports:

```ts
import { isServerConfigured } from "@/constants/oauth";
```

- [ ] **Step 2: Gate the notification effect**

Replace:

```ts
      // Register background health probe task
      registerHealthProbeTask();
      // Run a foreground check immediately on app launch
      checkPriceDropsNow();
      // Register for Expo push delivery (best-effort)
      void registerPushToken();
      // Pull any server-queued notification events
      void syncServerNotifications();
```

with:

```ts
      // Register background health probe task
      registerHealthProbeTask();
      // Run a foreground check immediately on app launch
      checkPriceDropsNow();
      if (isServerConfigured()) {
        // Register for Expo push delivery (best-effort)
        void registerPushToken();
        // Pull any server-queued notification events
        void syncServerNotifications();
      }
```

- [ ] **Step 3: Gate sync setup**

Replace:

```ts
  useEffect(() => {
    const setup = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
    syncRef.current = setup;
    const unregister = registerSyncSetup(setup);
    return () => {
      unregister();
      syncRef.current = null;
    };
  }, [trpcClient]);
```

with:

```ts
  useEffect(() => {
    if (!isServerConfigured()) return;
    const setup = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
    syncRef.current = setup;
    const unregister = registerSyncSetup(setup);
    return () => {
      unregister();
      syncRef.current = null;
    };
  }, [trpcClient]);
```

- [ ] **Step 4: Gate the authenticated-effect server legs**

Inside the `useEffect` keyed on `[isAuthenticated]`, wrap the server call:

```ts
  useEffect(() => {
    if (isAuthenticated) {
      resetDeviceRevoked();
      syncRef.current?.syncNow();
      void backfillLocalHistory();
      void cleanupStaleDevices();
    }
  }, [isAuthenticated]);
```

becomes:

```ts
  useEffect(() => {
    if (isAuthenticated && isServerConfigured()) {
      resetDeviceRevoked();
      syncRef.current?.syncNow();
      void backfillLocalHistory();
      void cleanupStaleDevices();
    }
  }, [isAuthenticated]);
```

- [ ] **Step 5: Gate FX loading**

Replace:

```ts
  useEffect(() => {
    void loadFxRates();
    void maybeRefreshFxRates();
  }, []);
```

with:

```ts
  useEffect(() => {
    if (!isServerConfigured()) return;
    void loadFxRates();
    void maybeRefreshFxRates();
  }, []);
```

(Static rates in `lib/currency.ts` remain the conversion source offline.)

- [ ] **Step 6: Verify**

Run: `pnpm check && pnpm vitest run tests/sync.test.ts tests/fx.test.ts`
Expected: 0 errors; both suites PASS.

- [ ] **Step 7: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: skip server-only startup work when no api server is configured"
```

---

### Task 6: Local-only UI (Settings, connection badge, images/insights)

**Files:**
- Modify: `lib/live-prices.ts` (`ConnectionStatus` type + `deriveConnectionStatus`)
- Modify: `components/connection-badge.tsx` (CONFIG map)
- Modify: `hooks/use-connection.ts`
- Modify: `app/(tabs)/settings.tsx` (syncStatus block ~lines 73-76; AccountSection render ~line 202)
- Modify: `lib/server-images.ts` / `lib/server-insights.ts`
- Test: `tests/use-connection.test.tsx`, `tests/live-prices.test.ts`

- [ ] **Step 1: Extend the connection status (failing tests)**

In `tests/live-prices.test.ts`, find the existing `deriveConnectionStatus` tests and add:

```ts
it("derives local mode when no server is configured", () => {
  expect(
    deriveConnectionStatus({ reachable: false, isAuthenticated: false, configured: false }),
  ).toBe("local");
});

it("configured=false wins over reachable=true", () => {
  expect(
    deriveConnectionStatus({ reachable: true, isAuthenticated: true, configured: false }),
  ).toBe("local");
});
```

Update any existing `deriveConnectionStatus(...)` calls in that file to pass
`configured: true`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/live-prices.test.ts`
Expected: FAIL — `configured` not in args; `"local"` not a valid status.

- [ ] **Step 3: Extend the status type + derivation**

In `lib/live-prices.ts`, replace:

```ts
export type ConnectionStatus = "connected" | "signed-out" | "offline";

export function deriveConnectionStatus(args: {
  reachable: boolean;
  isAuthenticated: boolean;
}): ConnectionStatus {
  if (!args.reachable) return "offline";
  return args.isAuthenticated ? "connected" : "signed-out";
}
```

with:

```ts
export type ConnectionStatus =
  | "connected"
  | "signed-out"
  | "offline"
  | "local";

export function deriveConnectionStatus(args: {
  reachable: boolean;
  isAuthenticated: boolean;
  configured: boolean;
}): ConnectionStatus {
  if (!args.configured) return "local";
  if (!args.reachable) return "offline";
  return args.isAuthenticated ? "connected" : "signed-out";
}
```

- [ ] **Step 4: Badge label**

In `components/connection-badge.tsx`, extend CONFIG:

```ts
const CONFIG: Record<
  ConnectionStatus,
  { label: string; color: "success" | "warning" | "error" | "muted" }
> = {
  connected: { label: "Connected", color: "success" },
  "signed-out": { label: "Signed out", color: "warning" },
  offline: { label: "Offline", color: "error" },
  local: { label: "Local mode", color: "muted" },
};
```

(If `colors.muted` exists in `useColors()` this compiles as-is; otherwise use
`colors.border` for the local entry's color value.)

- [ ] **Step 5: Thread `configured` through `useConnection`**

In `hooks/use-connection.ts`, import the gate and pass it through wherever
`deriveConnectionStatus` is invoked inside the hook (add `configured:
isServerConfigured()` to the args object). Apply the same one-line change to any
other caller of `deriveConnectionStatus` (grep: `grep -rn
"deriveConnectionStatus" app components hooks lib`).

Update `tests/use-connection.test.tsx` call sites with `configured: true`.

- [ ] **Step 6: Settings local-only mode**

In `app/(tabs)/settings.tsx`:

a) Add imports:

```ts
import { useServerConfig } from "@/hooks/use-server-config";
```

b) Inside the component body (near the existing `syncStatus` memo, ~line 70):

```ts
  const { configured } = useServerConfig();
```

c) Replace the `syncStatus` ternary chain's signed-out branch and gate the
AccountSection render. At ~line 73 change:

```ts
      : { label: "Sign in to sync across devices", tone: "muted" as const };
```

to:

```ts
      : configured
        ? { label: "Sign in to sync across devices", tone: "muted" as const }
        : { label: "Local-only mode — prices are fetched on this device", tone: "muted" as const };
```

d) At the `<AccountSection ... />` render (~line 202), wrap:

```tsx
        {configured ? (
          <AccountSection
            /* existing props unchanged */
          />
        ) : (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
            Local-only mode — prices are fetched directly from distributors on
            this device. Sign-in and cross-device sync are unavailable.
          </Text>
        )}
```

(Keep the exact existing props; `colors` comes from the component's existing
`useColors()` call — reuse it rather than adding a new one.)

e) Also gate any push-notification settings row: find the notifications section
rendered in this file and wrap it in `{configured && (...)}` if (and only if) it
toggles server-side push delivery — local notification toggles stay visible.

- [ ] **Step 7: Short-circuit images/insights**

In `lib/server-images.ts`, add the import and first line of `fetchProductImage`:

```ts
import { isServerConfigured } from "@/constants/oauth";
```

```ts
export async function fetchProductImage(
  productId: string,
  opts?: { timeoutMs?: number },
): Promise<ProductImage | null> {
  if (!isServerConfigured()) return null;
  try {
```

In `lib/server-insights.ts`, identically:

```ts
import { isServerConfigured } from "@/constants/oauth";
```

```ts
export async function fetchPriceInsight(
  productId: string,
): Promise<PriceInsight | null> {
  if (!isServerConfigured()) return null;
  try {
```

- [ ] **Step 8: Run affected suites**

Run: `pnpm check && pnpm vitest run tests/use-connection.test.tsx tests/live-prices.test.ts tests/settings.test.ts`
Expected: 0 errors; suites PASS (`settings.test.ts`: update any render that now
depends on `configured` by wrapping the render helper with a mocked
`useServerConfig` returning `{ configured: true }`; add one unconfigured case
asserting the local-only note renders and AccountSection does not).

If `tests/settings.test.ts` does not exist, create a minimal one following
`tests/use-connection.test.tsx` patterns:

```ts
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ configured: true }));

vi.mock("@/hooks/use-server-config", () => ({
  useServerConfig: vi.fn(() => ({ configured: state.configured })),
}));

// Render Settings with required providers as the existing hook tests do and
// assert on the local-only note vs AccountSection presence.
```

Complete the render assertions using the same testing-library style as
`tests/use-connection.test.tsx`.

- [ ] **Step 9: Commit**

```bash
git add lib/live-prices.ts components/connection-badge.tsx hooks/use-connection.ts \
  app/(tabs)/settings.tsx lib/server-images.ts lib/server-insights.ts \
  tests/use-connection.test.tsx tests/live-prices.test.ts tests/settings.test.ts
git commit -m "feat: local-only mode ui and server short-circuits"
```

---

### Task 7: Spec erratum, full verification, checkpoint

**Files:**
- Modify: `docs/superpowers/specs/2026-08-26-optional-server-design.md` (Consumers list)

- [ ] **Step 1: Correct the spec erratum**

In the spec's Consumers list, replace:

```
- `checkPriceDropsNow` uses `resolvePrice`.
```

with:

```
- `checkPriceDropsNow` needs no change — it delegates to `refreshListing`,
  which already implements the hybrid pattern manually.
```

- [ ] **Step 2: Full verification**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: tsc 0 errors; lint 0 errors (pre-existing warnings acceptable); all
tests pass.

Also run the desktop toolchain check since shared files changed:

Run: `pnpm check:desktop`
Expected: 0 errors.

- [ ] **Step 3: Checkpoint commit**

```bash
git add docs/superpowers/specs/2026-08-26-optional-server-design.md
git commit -m "Checkpoint: v6.9: Optional server / android standalone. TypeScript: 0 errors."
```

(Include any fixup files from Steps 1-2 in the same commit.)

---

## Out of scope (per spec)

- `refreshListing` keeps its own hybrid implementation (health classification needs raw fetch status).
- No user-facing price-source toggle (hybrid behavior is automatic).
- Web push/VAPID flows unchanged; unconfigured static web simply takes the same local-only path.
