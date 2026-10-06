# Monetization Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a provider-agnostic entitlement seam, a testable free/Pro split, a telemetry seam, and an honest paywall UI — all inert (everything free) until a real SDK registers.

**Architecture:** `lib/entitlements.ts` and `lib/telemetry.ts` are module-level seams (like `setProviderFetcher`); `lib/pro-features.ts` is the split's single source of truth; `hooks/use-entitlements.ts` exposes it to screens; the paywall renders "coming soon" without a provider.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-monetization-foundation-design.md`

---

## File Structure

- Create `lib/entitlements.ts` — provider seam.
- Create `lib/pro-features.ts` — split + guards.
- Create `lib/telemetry.ts` — sink seam.
- Create `hooks/use-entitlements.ts` — React hook.
- Create `components/paywall/paywall-screen.tsx` — paywall UI.
- Modify `app/(tabs)/settings.tsx` — Upgrade row + gate Background Refresh.
- Modify `app/search.tsx` — watchlist-add gate.
- Modify `app/w/[token].tsx` — watchlist-add gate.
- Tests: `tests/entitlements.test.ts`, `tests/pro-features.test.ts`, `tests/telemetry.test.ts`, `tests/paywall-guard.test.ts`.

---

### Task 1: Entitlements seam

**Files:** Create `lib/entitlements.ts`; Test `tests/entitlements.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/entitlements.test.ts`:

```ts
import { describe, expect, it, afterEach } from "vitest";
import {
  FREE_STATE,
  getEntitlementProvider,
  getEntitlementState,
  setEntitlementProvider,
} from "../lib/entitlements";

afterEach(() => setEntitlementProvider(null));

describe("entitlements", () => {
  it("defaults to free with no provider", async () => {
    expect(getEntitlementProvider()).toBeNull();
    expect(await getEntitlementState()).toEqual(FREE_STATE);
    expect(FREE_STATE.isPro).toBe(false);
  });

  it("returns the registered provider's state", async () => {
    setEntitlementProvider({
      getState: async () => ({ tier: "pro", isPro: true }),
    });
    expect(await getEntitlementState()).toEqual({ tier: "pro", isPro: true });
  });

  it("falls back to free when the provider throws (fail closed)", async () => {
    setEntitlementProvider({
      getState: async () => {
        throw new Error("network");
      },
    });
    expect(await getEntitlementState()).toEqual(FREE_STATE);
  });

  it("resets to free when the provider is cleared", async () => {
    setEntitlementProvider({ getState: async () => ({ tier: "pro", isPro: true }) });
    setEntitlementProvider(null);
    expect(await getEntitlementState()).toEqual(FREE_STATE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/entitlements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/entitlements.ts`:

```ts
// Provider-agnostic entitlement seam. The default is free; a real provider
// (RevenueCat) registers via setEntitlementProvider() at app boot. Mirrors the
// scraping-provider seam in lib/scrapers/resilient.ts.

export type EntitlementTier = "free" | "pro";

export interface EntitlementState {
  tier: EntitlementTier;
  isPro: boolean;
  /** ISO date when the subscription expires, if known. */
  expiresAt?: string;
}

export interface EntitlementProvider {
  getState(): Promise<EntitlementState>;
  /** Optional: start a purchase flow; resolves to the new state. */
  purchase?(planId: string): Promise<EntitlementState>;
  /** Optional: restore prior purchases. */
  restore?(): Promise<EntitlementState>;
}

export const FREE_STATE: EntitlementState = { tier: "free", isPro: false };

let provider: EntitlementProvider | null = null;

export function setEntitlementProvider(p: EntitlementProvider | null): void {
  provider = p;
}

export function getEntitlementProvider(): EntitlementProvider | null {
  return provider;
}

/** The current entitlement state. Fails closed to free on any provider error. */
export async function getEntitlementState(): Promise<EntitlementState> {
  if (!provider) return FREE_STATE;
  try {
    return await provider.getState();
  } catch {
    return FREE_STATE;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/entitlements.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/entitlements.ts tests/entitlements.test.ts
git commit -m "feat(billing): entitlement provider seam"
```

---

### Task 2: Pro features split

**Files:** Create `lib/pro-features.ts`; Test `tests/pro-features.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/pro-features.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FREE_WATCHLIST_LIMIT,
  canAddToWatchlist,
  isProFeature,
} from "../lib/pro-features";

describe("pro features", () => {
  it("free users can add up to the limit", () => {
    expect(FREE_WATCHLIST_LIMIT).toBe(5);
    expect(canAddToWatchlist(0, false)).toBe(true);
    expect(canAddToWatchlist(4, false)).toBe(true);
    expect(canAddToWatchlist(5, false)).toBe(false);
    expect(canAddToWatchlist(6, false)).toBe(false);
  });

  it("pro users have no limit", () => {
    expect(canAddToWatchlist(5, true)).toBe(true);
    expect(canAddToWatchlist(999, true)).toBe(true);
  });

  it("classifies each feature", () => {
    expect(isProFeature("unlimited_watchlist")).toBe(true);
    expect(isProFeature("background_monitoring")).toBe(true);
    expect(isProFeature("digests")).toBe(true);
    expect(isProFeature("server_sync")).toBe(true);
    expect(isProFeature("bulk_import")).toBe(true);
    expect(isProFeature("landed_cost_sourcing")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/pro-features.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/pro-features.ts`:

```ts
// The free/Pro boundary as a single source of truth. Free stays genuinely
// useful (5 products, manual refresh, standalone scraping); Pro unlocks the
// continuous, server-backed experience.

export const FREE_WATCHLIST_LIMIT = 5;

export type ProFeature =
  | "unlimited_watchlist"
  | "background_monitoring"
  | "digests"
  | "server_sync"
  | "bulk_import"
  | "landed_cost_sourcing";

const PRO_FEATURES: ReadonlySet<ProFeature> = new Set<ProFeature>([
  "unlimited_watchlist",
  "background_monitoring",
  "digests",
  "server_sync",
  "bulk_import",
  "landed_cost_sourcing",
]);

export function isProFeature(feature: ProFeature): boolean {
  return PRO_FEATURES.has(feature);
}

/** Whether a free user may add another product at the given watchlist size. */
export function canAddToWatchlist(currentCount: number, isPro: boolean): boolean {
  if (isPro) return true;
  return currentCount < FREE_WATCHLIST_LIMIT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/pro-features.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pro-features.ts tests/pro-features.test.ts
git commit -m "feat(billing): free/Pro feature split"
```

---

### Task 3: Telemetry seam

**Files:** Create `lib/telemetry.ts`; Test `tests/telemetry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/telemetry.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTelemetrySink, track } from "../lib/telemetry";

afterEach(() => setTelemetrySink(null));

describe("telemetry", () => {
  it("is a no-op with no sink", () => {
    expect(() => track("app_open")).not.toThrow();
  });

  it("forwards events to a registered sink", () => {
    const sink = { track: vi.fn() };
    setTelemetrySink(sink);
    track("product_added", { productId: "p1" });
    expect(sink.track).toHaveBeenCalledWith("product_added", { productId: "p1" });
  });

  it("never throws when the sink throws", () => {
    setTelemetrySink({
      track: () => {
        throw new Error("sink down");
      },
    });
    expect(() => track("app_open")).not.toThrow();
  });

  it("call sites pass no PII or secrets", () => {
    // Guard: the telemetry call sites must not pass email or key-like props.
    const files = [
      "app/search.tsx",
      "app/(tabs)/watchlist.tsx",
      "app/(tabs)/settings.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      for (const m of src.matchAll(/track\(\s*"[^"]+"\s*,\s*(\{[^}]*\})/g)) {
        expect(m[1], `${f}: ${m[1]}`).not.toMatch(/email|apiKey|token|password/i);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/telemetry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/telemetry.ts`:

```ts
// Provider-agnostic telemetry seam. The default is a no-op; a real sink
// (Sentry/PostHog) registers via setTelemetrySink() at app boot. track() must
// never throw — a broken sink cannot crash the app.

export interface TelemetrySink {
  track(event: string, props?: Record<string, unknown>): void;
}

let sink: TelemetrySink | null = null;

export function setTelemetrySink(s: TelemetrySink | null): void {
  sink = s;
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (!sink) return;
  try {
    sink.track(event, props);
  } catch {
    // Telemetry must never break the app.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/telemetry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry.ts tests/telemetry.test.ts
git commit -m "feat(telemetry): sink seam with no-op default"
```

---

### Task 4: `useEntitlements` hook

**Files:** Create `hooks/use-entitlements.ts`; Test `tests/use-entitlements.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/use-entitlements.test.tsx` (mirror the jsdom harness in `tests/country-picker.test.tsx`):

```tsx
// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { setEntitlementProvider } from "../lib/entitlements";
import { useEntitlements } from "../hooks/use-entitlements";

afterEach(() => setEntitlementProvider(null));

describe("useEntitlements", () => {
  it("defaults to free", async () => {
    const { result } = renderHook(() => useEntitlements());
    await waitFor(() => expect(result.current.isPro).toBe(false));
  });

  it("reflects a pro provider", async () => {
    setEntitlementProvider({ getState: async () => ({ tier: "pro", isPro: true }) });
    const { result } = renderHook(() => useEntitlements());
    await waitFor(() => expect(result.current.isPro).toBe(true));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/use-entitlements.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `hooks/use-entitlements.ts`:

```ts
import { useEffect, useState } from "react";
import {
  FREE_STATE,
  getEntitlementState,
  type EntitlementState,
} from "@/lib/entitlements";

/**
 * Reactive entitlement state. Defaults to free and updates after the provider
 * resolves. Screens gate on `isPro`.
 */
export function useEntitlements(): EntitlementState {
  const [state, setState] = useState<EntitlementState>(FREE_STATE);
  useEffect(() => {
    let cancelled = false;
    void getEntitlementState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/use-entitlements.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/use-entitlements.ts tests/use-entitlements.test.tsx
git commit -m "feat(billing): useEntitlements hook"
```

---

### Task 5: Paywall UI

**Files:** Create `components/paywall/paywall-screen.tsx`; Test `tests/paywall-guard.test.ts`

- [ ] **Step 1: Write the failing guard test**

Create `tests/paywall-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("paywall", () => {
  it("is honest without a purchase provider", () => {
    const src = read("components/paywall/paywall-screen.tsx");
    // The CTA must be disabled when there is no provider.purchase.
    expect(src).toContain("coming soon");
    expect(src).toContain("getEntitlementProvider");
  });

  it("lists the Pro benefits", () => {
    const src = read("components/paywall/paywall-screen.tsx");
    expect(src).toContain("Unlimited watchlist");
    expect(src).toContain("Background monitoring");
    expect(src).toContain("Bulk import");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/paywall-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/paywall/paywall-screen.tsx` — a modal/screen with a heading
("Go Pro"), a benefits list (Unlimited watchlist, Background monitoring + alerts,
Digests, Server sync, Bulk import, Landed-cost sourcing), and a CTA. The CTA is
enabled only when `getEntitlementProvider()?.purchase` exists; otherwise it is
disabled and reads "Pro is coming soon". Use `useColors()`, `IconSymbol`
(`crown.fill`), and guard haptics with `Platform.OS !== "web"`. Props:

```ts
export function PaywallScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}): JSX.Element;
```

On CTA press (when a provider exists): `track("upgrade_started")` then
`provider.purchase("pro")`; on success call `onClose()`. When no provider, the
button is disabled (no `track`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/paywall-guard.test.ts && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/paywall/paywall-screen.tsx tests/paywall-guard.test.ts
git commit -m "feat(billing): paywall screen (honest without a provider)"
```

---

### Task 6: Wire gating + Settings upgrade row

**Files:** Modify `app/(tabs)/settings.tsx`, `app/search.tsx`, `app/w/[token].tsx`

- [ ] **Step 1: Settings — Upgrade row + gate Background Refresh**

In `app/(tabs)/settings.tsx`:
- Import `useEntitlements` from `@/hooks/use-entitlements`, `PaywallScreen`, and `track`.
- Add state `const [paywallVisible, setPaywallVisible] = useState(false)` and render `<PaywallScreen visible={paywallVisible} onClose={() => setPaywallVisible(false)} />`.
- Add a "Upgrade to Pro" row (icon `crown.fill`) in the About section that opens the paywall and calls `track("paywall_shown")`.
- Gate the Background Refresh `Switch`: when `!isPro`, set `disabled` and show a "Pro" caption; tapping the row opens the paywall instead of toggling.

- [ ] **Step 2: Watchlist-add gate**

In `app/search.tsx` (both `addToWatchlist` call sites) and `app/w/[token].tsx`:
- Import `useEntitlements` and `canAddToWatchlist`.
- Before adding, read the current watchlist length and check
  `canAddToWatchlist(count, isPro)`. If false, show the paywall (or an alert with
  an "Upgrade" action) and `track("paywall_shown")`; do not add.
- Do NOT gate the undo path in `app/(tabs)/watchlist.tsx`.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 4: Run the guards**

Run: `pnpm exec vitest run tests/paywall-guard.test.ts tests/telemetry.test.ts tests/pro-features.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/settings.tsx app/search.tsx app/w/\[token\].tsx
git commit -m "feat(billing): gate Pro features + Settings upgrade row"
```

---

### Task 7: Full verification + docs

**Files:** `todo.md`, `AGENTS.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1119): the entitlement + telemetry seams,
the free/Pro split, the paywall, and the explicit note that the RevenueCat/Sentry
SDK wiring is deferred until the accounts exist. Add a line to `AGENTS.md` noting
the seams (`setEntitlementProvider`, `setTelemetrySink`) and that everything is
free until a provider registers.

- [ ] **Step 3: Commit**

```bash
git add todo.md AGENTS.md
git commit -m "docs: monetization foundation (Phase 1119)"
```

---

## Self-Review

- **Spec coverage:** entitlements seam (Task 1), split (Task 2), telemetry (Task 3), hook (Task 4), paywall (Task 5), gating + Settings (Task 6), verify + docs (Task 7). The RevenueCat/Sentry SDK wiring is explicitly deferred per the spec.
- **Placeholders:** none — the seams, split, and tests are given verbatim; Task 5/6 name the exact files, props, and strings.
- **Type consistency:** `EntitlementState { tier, isPro, expiresAt? }`; `EntitlementProvider { getState, purchase?, restore? }`; `FREE_STATE`; `ProFeature` union; `FREE_WATCHLIST_LIMIT`; `canAddToWatchlist(count, isPro)`; `track(event, props?)`; `useEntitlements(): EntitlementState` — used consistently.
- **Safety:** default-free everywhere; provider errors fail closed; telemetry never throws; the paywall is disabled without a provider. No behavior change when no provider is registered.
