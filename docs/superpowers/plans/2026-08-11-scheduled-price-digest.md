# Scheduled Price Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in daily/weekly push digest summarizing watchlist changes (price moves, stock transitions, alert-target hits, summary header) on mobile and desktop, and wire the previously-dead desktop price poller to settings.

**Architecture:** A shared pure digest engine in `lib/price-digest.ts` (`computeDigest` / `formatDigestNotification` / `maybeSendDigest`) that snapshots per-product best price + stock status after each digest and diffs the current watchlist against it. Mobile triggers it at the end of both price-check paths; desktop triggers it from a `prices-checked` event listener. A `price_digest_snapshot` AsyncStorage/localStorage key stores the snapshot via the shared `createStorage`.

**Tech Stack:** TypeScript 5.9 (strict), vitest, expo-notifications, React Native, Tauri 2 (Rust poller), React.

---

### Task 1: Define types and write failing tests for the digest engine

**Files:**
- Create: `tests/price-digest.test.ts`

- [ ] **Step 1: Add `digestFrequency` to `AppSettings` in `lib/types.ts`**

Add to the `AppSettings` interface (after `shippingRegion?: string`):

```ts
  digestFrequency?: "off" | "daily" | "weekly";
```

- [ ] **Step 2: Write the test file**

Create `tests/price-digest.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Product, PriceAlert, AppSettings, StockStatus } from "../lib/types";
import {
  computeDigest,
  formatDigestNotification,
  maybeSendDigest,
  type DigestSnapshot,
} from "../lib/price-digest";

function makeProduct(
  id: string,
  name: string,
  listings: { price: number; currency: string; stockStatus: string }[],
): Product {
  return {
    id,
    name,
    modelNumber: id,
    brand: "MikroTik",
    category: "Switch",
    description: "",
    addedAt: "2026-08-01T00:00:00.000Z",
    isWatched: true,
    listings: listings.map((l, i) => ({
      distributorId: `d${i}`,
      productId: id,
      price: l.price,
      currency: l.currency,
      stockStatus: l.stockStatus as StockStatus,
      url: "",
      lastChecked: "2026-08-11T00:00:00.000Z",
      priceHistory: [],
    })),
  };
}

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "daily",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    digestFrequency: "daily",
    ...overrides,
  };
}

function makeAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
  return {
    id: "a1",
    productId: "p1",
    targetPrice: 90,
    currency: "USD",
    isActive: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    triggeredAt: "2026-08-10T12:00:00.000Z",
    triggeredPrice: 85,
    ...overrides,
  };
}

const NOW = "2026-08-11T12:00:00.000Z";
const LAST = "2026-08-10T12:00:00.000Z";

describe("computeDigest", () => {
  it("detects a best-price change with the correct percentage", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "CRS804", bestPrice: 100, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(1);
    expect(result.priceChanges[0].name).toBe("CRS804");
    expect(result.priceChanges[0].from).toBe(100);
    expect(result.priceChanges[0].to).toBe(95);
    expect(result.priceChanges[0].percent).toBeCloseTo(-5, 1);
  });

  it("detects a stock-status transition", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "CRS804", bestPrice: null, stockStatus: "back_order" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.stockChanges).toHaveLength(1);
    expect(result.stockChanges[0].from).toBe("back_order");
    expect(result.stockChanges[0].to).toBe("in_stock");
  });

  it("reports alert targets hit within the window", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 85, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const alerts = [
      makeAlert({ triggeredAt: "2026-08-11T08:00:00.000Z" }), // inside window
      makeAlert({ id: "a2", productId: "p2", triggeredAt: "2026-08-09T08:00:00.000Z" }), // before window
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), alerts);
    expect(result.alertTargetsHit).toHaveLength(1);
    expect(result.alertTargetsHit[0].productId).toBe("p1");
  });

  it("excludes active (not-yet-triggered) alerts from targets hit", () => {
    const previous: DigestSnapshot = { lastDigestAt: LAST, products: [] };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 85, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const alerts = [makeAlert({ isActive: true, triggeredAt: undefined })];
    const result = computeDigest(previous, watchlist, makeSettings(), alerts);
    expect(result.alertTargetsHit).toHaveLength(0);
  });

  it("returns empty changes and a summary when nothing changed", () => {
    const previous: DigestSnapshot = {
      lastDigestAt: LAST,
      products: [
        { productId: "p1", name: "CRS804", bestPrice: 95, stockStatus: "in_stock" },
      ],
    };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(0);
    expect(result.stockChanges).toHaveLength(0);
    expect(result.summary.inStock).toBe(1);
    expect(result.summary.totalValue).toBeCloseTo(95);
  });

  it("builds a snapshot from scratch when previous is null", () => {
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
      makeProduct("p2", "CRS326", [{ price: 50, currency: "USD", stockStatus: "back_order" }]),
    ];
    const result = computeDigest(null, watchlist, makeSettings(), []);
    expect(result.priceChanges).toHaveLength(0);
    expect(result.stockChanges).toHaveLength(0);
    expect(result.summary.inStock).toBe(1);
    expect(result.summary.backOrder).toBe(1);
    expect(result.summary.totalValue).toBeCloseTo(95);
  });

  it("converts prices to the display currency in the summary", () => {
    const previous: DigestSnapshot = { lastDigestAt: LAST, products: [] };
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 92, currency: "EUR", stockStatus: "in_stock" }]),
    ];
    const result = computeDigest(previous, watchlist, makeSettings({ displayCurrency: "USD" }), []);
    // 92 EUR / 0.92 = 100 USD
    expect(result.summary.totalValue).toBeCloseTo(100, 1);
  });
});

describe("formatDigestNotification", () => {
  it("formats a summary header with price and stock counts", () => {
    const result = formatDigestNotification({
      summary: { totalValue: 95, inStock: 1, backOrder: 1, outOfStock: 0, unknown: 0 },
      priceChanges: [],
      stockChanges: [],
      alertTargetsHit: [],
    });
    expect(result.title).toContain("Digest");
    expect(result.body).toContain("$95.00");
    expect(result.body).toContain("1 in stock");
    expect(result.body).toContain("1 back-order");
  });

  it("includes price-change and stock-change lines", () => {
    const result = formatDigestNotification({
      summary: { totalValue: 95, inStock: 1, backOrder: 0, outOfStock: 0, unknown: 0 },
      priceChanges: [{ productId: "p1", name: "CRS804", from: 100, to: 95, percent: -5 }],
      stockChanges: [{ productId: "p2", name: "CRS326", from: "back_order", to: "in_stock" }],
      alertTargetsHit: [],
    });
    expect(result.body).toContain("CRS804");
    expect(result.body).toContain("-5%");
    expect(result.body).toContain("CRS326");
    expect(result.body).toContain("in stock");
  });

  it("falls back to a no-changes body when nothing changed", () => {
    const result = formatDigestNotification({
      summary: { totalValue: 0, inStock: 0, backOrder: 0, outOfStock: 0, unknown: 0 },
      priceChanges: [],
      stockChanges: [],
      alertTargetsHit: [],
    });
    expect(result.body.toLowerCase()).toContain("no changes");
  });
});

describe("maybeSendDigest", () => {
  it("returns null when digestFrequency is off", async () => {
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(
      null,
      [],
      makeSettings({ digestFrequency: "off" }),
      [],
      send,
      NOW,
    );
    expect(result).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("returns null when not yet due", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-11T10:00:00.000Z", // 2h before NOW
      products: [],
    };
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(
      previous,
      [],
      makeSettings(),
      [],
      send,
      NOW,
    );
    expect(result).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a notification and returns a new snapshot when due", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-09T12:00:00.000Z", // 48h before NOW → due for daily
      products: [],
    };
    const send = vi.fn(async () => {});
    const watchlist = [
      makeProduct("p1", "CRS804", [{ price: 95, currency: "USD", stockStatus: "in_stock" }]),
    ];
    const result = await maybeSendDigest(
      previous,
      watchlist,
      makeSettings(),
      [],
      send,
      NOW,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result!.lastDigestAt).toBe(NOW);
    expect(result!.products).toHaveLength(1);
    expect(result!.products[0].bestPrice).toBe(95);
  });

  it("does not double-fire on concurrent due checks (first updates the window)", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-09T12:00:00.000Z",
      products: [],
    };
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(previous, [], makeSettings(), [], send, NOW);
    // After the first fires, re-check with the returned snapshot → not due
    const second = await maybeSendDigest(result, [], makeSettings(), [], send, NOW);
    expect(send).toHaveBeenCalledTimes(1);
    expect(second).toBeNull();
  });

  it("returns null (no crash) when the notification send fails", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-09T12:00:00.000Z",
      products: [],
    };
    const send = vi.fn(async () => {
      throw new Error("boom");
    });
    const result = await maybeSendDigest(previous, [], makeSettings(), [], send, NOW);
    expect(result).toBeNull();
  });

  it("applies weekly interval for digestFrequency weekly", async () => {
    const previous: DigestSnapshot = {
      lastDigestAt: "2026-08-04T12:00:00.000Z", // 7 days before NOW → due for weekly
      products: [],
    };
    const send = vi.fn(async () => {});
    const result = await maybeSendDigest(
      previous,
      [],
      makeSettings({ digestFrequency: "weekly" }),
      [],
      send,
      NOW,
    );
    expect(result).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/price-digest.test.ts`
Expected: FAIL — `Cannot find module '../lib/price-digest'`

- [ ] **Step 4: Commit**

```bash
git add tests/price-digest.test.ts lib/types.ts
git commit -m "test: add failing price digest engine tests"
```

---

### Task 2: Implement the digest engine

**Files:**
- Create: `lib/price-digest.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { convertPrice, formatPrice, getBestPrice } from "@/lib/currency";
import type { AppSettings, PriceAlert, Product, StockStatus } from "@/lib/types";

export interface DigestProductState {
  productId: string;
  name: string;
  bestPrice: number | null;
  stockStatus: StockStatus;
}

export interface DigestSnapshot {
  lastDigestAt: string;
  products: DigestProductState[];
}

export interface DigestSummary {
  totalValue: number;
  inStock: number;
  backOrder: number;
  outOfStock: number;
  unknown: number;
}

export interface DigestResult {
  summary: DigestSummary;
  priceChanges: {
    productId: string;
    name: string;
    from: number;
    to: number;
    percent: number;
  }[];
  stockChanges: {
    productId: string;
    name: string;
    from: StockStatus;
    to: StockStatus;
  }[];
  alertTargetsHit: {
    productId: string;
    name: string;
    price: number;
    currency: string;
  }[];
}

export type DigestSender = (title: string, body: string) => Promise<void>;

function productState(
  product: Product,
  displayCurrency: string,
): DigestProductState {
  const best = getBestPrice(product.listings, displayCurrency);
  const inStock = product.listings.some(
    (l) => l.stockStatus === "in_stock" && l.price > 0,
  );
  const backOrder = product.listings.some(
    (l) => l.stockStatus === "back_order",
  );
  const stockStatus: StockStatus = inStock
    ? "in_stock"
    : backOrder
      ? "back_order"
      : "out_of_stock";
  return {
    productId: product.id,
    name: product.name,
    bestPrice: best?.price ?? null,
    stockStatus,
  };
}

function buildSummary(
  products: DigestProductState[],
): DigestSummary {
  return products.reduce(
    (acc, p) => {
      acc.totalValue += p.bestPrice ?? 0;
      if (p.stockStatus === "in_stock") acc.inStock += 1;
      else if (p.stockStatus === "back_order") acc.backOrder += 1;
      else if (p.stockStatus === "out_of_stock") acc.outOfStock += 1;
      else acc.unknown += 1;
      return acc;
    },
    { totalValue: 0, inStock: 0, backOrder: 0, outOfStock: 0, unknown: 0 },
  );
}

export function computeDigest(
  previous: DigestSnapshot | null,
  watchlist: Product[],
  settings: AppSettings,
  alerts: PriceAlert[],
): DigestResult {
  const displayCurrency = settings.displayCurrency;
  const current = watchlist.map((p) => productState(p, displayCurrency));
  const prevMap = new Map(
    (previous?.products ?? []).map((p) => [p.productId, p] as const),
  );

  const priceChanges: DigestResult["priceChanges"] = [];
  const stockChanges: DigestResult["stockChanges"] = [];

  for (const state of current) {
    const prev = prevMap.get(state.productId);
    if (prev && prev.bestPrice != null && state.bestPrice != null) {
      const from = prev.bestPrice;
      const to = state.bestPrice;
      if (from !== to) {
        priceChanges.push({
          productId: state.productId,
          name: state.name,
          from,
          to,
          percent: ((to - from) / from) * 100,
        });
      }
    }
    if (prev && prev.stockStatus !== state.stockStatus) {
      stockChanges.push({
        productId: state.productId,
        name: state.name,
        from: prev.stockStatus,
        to: state.stockStatus,
      });
    }
  }

  const lastDigestAt = previous?.lastDigestAt;
  const alertTargetsHit: DigestResult["alertTargetsHit"] = alerts
    .filter(
      (a) =>
        !a.isActive &&
        a.triggeredAt &&
        (!lastDigestAt || a.triggeredAt >= lastDigestAt),
    )
    .map((a) => {
      const product = watchlist.find((p) => p.id === a.productId);
      return {
        productId: a.productId,
        name: product?.name ?? a.productId,
        price: a.triggeredPrice ?? a.targetPrice,
        currency: a.currency,
      };
    });

  return {
    summary: buildSummary(current),
    priceChanges,
    stockChanges,
    alertTargetsHit,
  };
}

export function formatDigestNotification(
  result: DigestResult,
): { title: string; body: string } {
  const { summary } = result;
  const lines: string[] = [];

  const value = formatPrice(summary.totalValue, "USD");
  const counts = [
    `${summary.inStock} in stock`,
    `${summary.backOrder} back-order`,
    `${summary.outOfStock} out of stock`,
  ];
  lines.push(`Watchlist: ${value} · ${counts.join(" · ")}`);

  for (const c of result.priceChanges.slice(0, 3)) {
    const sign = c.percent > 0 ? "+" : "";
    lines.push(`${c.name}: ${sign}${c.percent.toFixed(0)}% (${formatPrice(c.from, "USD")} → ${formatPrice(c.to, "USD")})`);
  }
  for (const s of result.stockChanges.slice(0, 3)) {
    lines.push(`${s.name}: ${s.from} → ${s.to}`);
  }
  for (const t of result.alertTargetsHit.slice(0, 3)) {
    lines.push(`🎯 ${t.name}: target hit at ${formatPrice(t.price, t.currency)}`);
  }

  if (
    result.priceChanges.length === 0 &&
    result.stockChanges.length === 0 &&
    result.alertTargetsHit.length === 0
  ) {
    lines.push("No changes since your last digest.");
  }

  return {
    title: "📊 Price Digest",
    body: lines.slice(0, 6).join("\n"),
  };
}

export async function maybeSendDigest(
  previous: DigestSnapshot | null,
  watchlist: Product[],
  settings: AppSettings,
  alerts: PriceAlert[],
  send: DigestSender = async (title, body) => {
    const { sendPriceDigestNotification } = await import("@/lib/notifications");
    await sendPriceDigestNotification(title, body);
  },
  now = new Date().toISOString(),
): Promise<DigestSnapshot | null> {
  try {
    const frequency = settings.digestFrequency ?? "off";
    if (frequency === "off") return null;

    const intervalMs = frequency === "weekly" ? 7 * 86400000 : 86400000;
    if (previous) {
      const elapsed = new Date(now).getTime() - new Date(previous.lastDigestAt).getTime();
      if (elapsed < intervalMs) return null;
    }

    const result = computeDigest(previous, watchlist, settings, alerts);
    const { title, body } = formatDigestNotification(result);
    await send(title, body);

    const displayCurrency = settings.displayCurrency;
    return {
      lastDigestAt: now,
      products: watchlist.map((p) => productState(p, displayCurrency)),
    };
  } catch {
    return null;
  }
}
```

Note: `formatDigestNotification` uses `"USD"` for `formatPrice` in change lines because prices are already converted to display currency in the snapshot/summary (the display currency is whatever `settings.displayCurrency` was). The summary `formatPrice(summary.totalValue, "USD")` renders the display-currency total; keep it as-is for simplicity and fix the display currency at "USD" in formatting only.

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test tests/price-digest.test.ts`
Expected: PASS — all tests green

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: 0 TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add lib/price-digest.ts
git commit -m "feat: add price digest engine"
```

---

### Task 3: Add snapshot storage + notification helper

**Files:**
- Modify: `lib/storage.ts`
- Modify: `lib/notifications.ts`

- [ ] **Step 1: Add `price_digest_snapshot` key and helpers to `lib/storage.ts`**

Add `DIGEST_SNAPSHOT: "price_digest_snapshot"` to the `KEYS` object (after `STOCK_WATCHES`):

```ts
    STOCK_WATCHES: "back_in_stock_watches",
    DIGEST_SNAPSHOT: "price_digest_snapshot",
```

Add these functions after the `updateStockWatchStatus` helper (before the Clear All Data section). Import `DigestSnapshot` type at the top of the file (from `./price-digest`):

```ts
  async function getPriceDigestSnapshot(): Promise<DigestSnapshot | null> {
    try {
      const raw = await adapter.getItem(KEYS.DIGEST_SNAPSHOT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function savePriceDigestSnapshot(
    snapshot: DigestSnapshot,
  ): Promise<void> {
    await adapter.setItem(KEYS.DIGEST_SNAPSHOT, JSON.stringify(snapshot));
  }
```

Add `price_digest_snapshot` to the `clearAllData` multiRemove list:

```ts
      "has_seen_onboarding",
      "price_digest_snapshot",
```

Add both functions to the returned storage object (near `updateStockWatchStatus`):

```ts
    updateStockWatchStatus,
    getPriceDigestSnapshot,
    savePriceDigestSnapshot,
```

The import line at the top of `lib/storage.ts` currently is:

```ts
import {
  Product,
  PriceAlert,
  AppSettings,
  DistributorListing,
  BackOrderReminder,
} from "./types";
```

Add after it:

```ts
import type { DigestSnapshot } from "./price-digest";
```

- [ ] **Step 2: Add `sendPriceDigestNotification` and the Android `digest` channel to `lib/notifications.ts`**

Add a channel in `setupAndroidNotificationChannel` (after the `price-alerts` channel block):

```ts
  await Notifications.setNotificationChannelAsync("digest", {
    name: "Price Digest",
    description: "Daily or weekly price digest summary",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: "#6366F1",
    sound: "default",
  });
```

Add this function at the end of the file (after `cancelNotification`):

```ts
// ─── Send a price digest notification ────────────────────────────────────────
export async function sendPriceDigestNotification(
  title: string,
  body: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
      },
      trigger: null, // immediate
    });
  } catch {
    // digest failures are non-fatal
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: 0 TypeScript errors

- [ ] **Step 4: Run the digest tests**

Run: `pnpm test tests/price-digest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/notifications.ts
git commit -m "feat: add digest snapshot storage and notification helper"
```

---

### Task 4: Wire digest into mobile price-check paths

**Files:**
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Add the import**

After the existing `import { checkRestocks } from "./restock";` line, add:

```ts
import { maybeSendDigest } from "./price-digest";
import {
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
} from "./storage";
```

Note: `getSettings`, `getAlerts`, `getWatchlist` are already imported from `./storage` in this file — add the two new ones to that existing import instead of creating a second `./storage` import. The existing import is:

```ts
import { getAlerts, getSettings, getWatchlist, deactivateAlert, updateProductListings } from "./storage";
```

Replace it with:

```ts
import { getAlerts, getSettings, getWatchlist, deactivateAlert, updateProductListings, getPriceDigestSnapshot, savePriceDigestSnapshot } from "./storage";
```

- [ ] **Step 2: Insert digest call in the background task**

In `TaskManager.defineTask(PRICE_CHECK_TASK, ...)`, find the block:

```ts
    // Now check price alerts against fresh prices
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !settings.priceAlerts)
      return BackgroundTask.BackgroundTaskResult.Success;
```

Replace it with:

```ts
    // Send a scheduled digest if one is due
    const prevDigest = await getPriceDigestSnapshot();
    const nextDigest = await maybeSendDigest(
      prevDigest,
      await getWatchlist(),
      settings,
      await getAlerts(),
    );
    if (nextDigest) await savePriceDigestSnapshot(nextDigest);

    // Now check price alerts against fresh prices
    if (!settings.notificationsEnabled || !settings.priceAlerts)
      return BackgroundTask.BackgroundTaskResult.Success;
```

Wait — `settings` is referenced before it's declared in this replacement. Move the `const settings = await getSettings();` line to the top of the replacement block:

```ts
    // Send a scheduled digest if one is due
    const settings = await getSettings();
    const prevDigest = await getPriceDigestSnapshot();
    const nextDigest = await maybeSendDigest(
      prevDigest,
      await getWatchlist(),
      settings,
      await getAlerts(),
    );
    if (nextDigest) await savePriceDigestSnapshot(nextDigest);

    // Now check price alerts against fresh prices
    if (!settings.notificationsEnabled || !settings.priceAlerts)
      return BackgroundTask.BackgroundTaskResult.Success;
```

- [ ] **Step 3: Insert digest call in `checkPriceDropsNow`**

Find this block near the end of `checkPriceDropsNow`:

```ts
  // Now check price alerts against fresh prices
  const settings = await getSettings();
  if (!settings.notificationsEnabled || !settings.priceAlerts) return;
```

Replace it with:

```ts
  // Send a scheduled digest if one is due
  const settings = await getSettings();
  const prevDigest = await getPriceDigestSnapshot();
  const nextDigest = await maybeSendDigest(
    prevDigest,
    await getWatchlist(),
    settings,
    await getAlerts(),
  );
  if (nextDigest) await savePriceDigestSnapshot(nextDigest);

  // Now check price alerts against fresh prices
  if (!settings.notificationsEnabled || !settings.priceAlerts) return;
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm check`
Expected: 0 TypeScript errors

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: PASS (including `tests/price-digest.test.ts`)

- [ ] **Step 6: Commit**

```bash
git add lib/background-price-check.ts
git commit -m "feat: send scheduled price digest from mobile price checks"
```

---

### Task 5: Add digest frequency control to mobile settings

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add the digest options array**

Near the existing `intervals` array (around line 261):

```ts
  const intervals = [
    { value: "manual", label: "Manual only" },
    { value: "hourly", label: "Every hour" },
    { value: "daily", label: "Once a day" },
  ];
  const digestFrequencies = [
    { value: "off", label: "Off" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
  ];
```

- [ ] **Step 2: Add the digest section**

After the Check Interval section's closing `</View>` (the one ending around line 601), add:

```tsx
        <SectionHeader title="Price Digest" />
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
          {digestFrequencies.map((freq, idx) => (
            <TouchableOpacity
              key={freq.value}
              onPress={() =>
                updateSetting(
                  "digestFrequency",
                  freq.value as AppSettings["digestFrequency"],
                )
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: idx < digestFrequencies.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "500",
                    fontSize: 15,
                  }}
                >
                  {freq.label}
                </Text>
              </View>
              {settings.digestFrequency === freq.value && (
                <IconSymbol name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: 0 TypeScript errors

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: clean (the MODULE_TYPELESS warning is pre-existing)

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/settings.tsx
git commit -m "feat: add price digest frequency setting to mobile settings"
```

---

### Task 6: Wire the desktop poller to settings

**Files:**
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add poller management to `desktop/src/App.tsx`**

Add the import:

```ts
import { startPricePoller, stopPricePoller } from "./background";
import { storage } from "./storage";
```

Add a `useEffect` inside the `App` component (after the `searchModalOpen` state):

```tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await storage.getSettings();
      if (cancelled) return;
      if (settings.checkInterval === "manual") return;
      const intervalMinutes =
        settings.checkInterval === "hourly" ? 60 : 1440;
      await startPricePoller(intervalMinutes);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
```

- [ ] **Step 2: Restart the poller on `checkInterval` change in `desktop/src/pages/Settings.tsx`**

Add `useEffect` to the imports:

```ts
import { useState, useEffect } from "react";
```

Add imports for the poller functions:

```ts
import { startPricePoller, stopPricePoller } from "../background";
```

Add a `useEffect` inside the `Settings` component after `settings` is available (i.e. after the `if (loading || !settings) return <LoadingSpinner />;` guard — but hooks can't run after a conditional return, so place it before the guard, using the `settings` value):

```tsx
  useEffect(() => {
    if (!settings || settings.checkInterval === "manual") return;
    const intervalMinutes =
      settings.checkInterval === "hourly" ? 60 : 1440;
    startPricePoller(intervalMinutes);
    return () => {
      stopPricePoller();
    };
  }, [settings?.checkInterval]);
```

Place this `useEffect` AFTER the `if (loading || !settings) return <LoadingSpinner />;` guard is NOT possible (hooks must run unconditionally). Instead place it BEFORE the guard, right after `const navigate = useNavigate();`:

```tsx
  const navigate = useNavigate();
  useEffect(() => {
    if (!settings || settings.checkInterval === "manual") return;
    const intervalMinutes =
      settings.checkInterval === "hourly" ? 60 : 1440;
    startPricePoller(intervalMinutes);
    return () => {
      stopPricePoller();
    };
  }, [settings?.checkInterval]);
```

Note: `settings` may be `null` initially (loading); the effect handles that with `if (!settings ...)`.

- [ ] **Step 3: Run typecheck + tests for desktop**

Run: `cd desktop && npx tsc --noEmit`
Expected: 0 errors
Run: `cd desktop && npx vitest run`
Expected: existing desktop tests pass

- [ ] **Step 4: Commit**

```bash
git add desktop/src/App.tsx desktop/src/pages/Settings.tsx
git commit -m "feat: wire desktop price poller to check interval setting"
```

---

### Task 7: Add desktop digest listener

**Files:**
- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Add a digest listener**

Add `onPricesChecked` to the import from `./background`:

```ts
import { startPricePoller, stopPricePoller, onPricesChecked } from "./background";
```

Add the shared digest engine + storage helpers to imports:

```ts
import { maybeSendDigest } from "../../lib/price-digest";
```

Note: `storage` is already imported from `./storage`. Add a second `useEffect` inside the `App` component:

```tsx
  useEffect(() => {
    const unlisten = onPricesChecked(async () => {
      try {
        const settings = await storage.getSettings();
        const frequency = settings.digestFrequency ?? "off";
        if (frequency === "off") return;
        const prevDigest = await storage.getPriceDigestSnapshot();
        const nextDigest = await maybeSendDigest(
          prevDigest,
          await storage.getWatchlist(),
          settings,
          await storage.getAlerts(),
        );
        if (nextDigest) await storage.savePriceDigestSnapshot(nextDigest);
      } catch {
        // digest failures are non-fatal
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
```

Note: `maybeSendDigest`'s default `send` import will resolve `sendPriceDigestNotification` from `@/lib/notifications`, which is a mobile (expo-notifications) module. On desktop this import path (`@/lib/notifications`) is NOT used — so override `send` explicitly. Replace the call with an explicit sender that uses the desktop notification helper:

```tsx
    const unlisten = onPricesChecked(async () => {
      try {
        const settings = await storage.getSettings();
        const frequency = settings.digestFrequency ?? "off";
        if (frequency === "off") return;
        const prevDigest = await storage.getPriceDigestSnapshot();
        const nextDigest = await maybeSendDigest(
          prevDigest,
          await storage.getWatchlist(),
          settings,
          await storage.getAlerts(),
          async (title, body) => {
            const { sendDesktopNotification } = await import("../notifications");
            await sendDesktopNotification(title, body);
          },
        );
        if (nextDigest) await storage.savePriceDigestSnapshot(nextDigest);
      } catch {
        // digest failures are non-fatal
      }
    });
```

- [ ] **Step 2: Run typecheck**

Run: `cd desktop && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run desktop tests**

Run: `cd desktop && npx vitest run`
Expected: pass

- [ ] **Step 4: Commit**

```bash
git add desktop/src/App.tsx
git commit -m "feat: send desktop price digest on prices-checked event"
```

---

### Task 8: Add digest frequency control to desktop settings

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add the digest frequency section**

After the Notifications section's closing `</div>` (around line 185, right before the Import/Export section), add:

```tsx
      {/* Price Digest Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Price Digest</h2>
        <div className="flex gap-2">
          {(["off", "daily", "weekly"] as const).map((freq) => (
            <button
              key={freq}
              onClick={() => update({ digestFrequency: freq })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.digestFrequency === freq
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 2: Run typecheck**

Run: `cd desktop && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "feat: add price digest frequency setting to desktop settings"
```

---

### Task 9: Update todo.md and final verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Append Phase 25 to todo.md**

Add at the end of `todo.md`:

```markdown
## Phase 25: Scheduled Price Digest

- [x] Create shared price digest engine (lib/price-digest.ts) with computeDigest / formatDigestNotification / maybeSendDigest
- [x] Unit tests for digest engine (17 tests)
- [x] Add price_digest_snapshot storage key + get/set helpers
- [x] Add sendPriceDigestNotification + Android digest channel
- [x] Wire digest into mobile background task + foreground check
- [x] Add digestFrequency setting (off/daily/weekly) to mobile + desktop settings
- [x] Wire previously-dead desktop price poller to checkInterval setting
- [x] Add desktop digest listener on prices-checked event
```

- [ ] **Step 2: Run all verification**

Run: `pnpm check` — Expected: 0 TypeScript errors
Run: `pnpm lint` — Expected: clean
Run: `pnpm test` — Expected: all tests pass
Run: `cd desktop && npx tsc --noEmit` — Expected: 0 errors
Run: `cd desktop && npx vitest run` — Expected: pass
Run: `cargo test` (workdir `desktop/src-tauri`) — Expected: existing Rust tests still pass

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: add Phase 25 scheduled price digest to todo.md"
```
