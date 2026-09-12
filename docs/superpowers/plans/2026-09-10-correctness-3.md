# Correctness Bundle 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instant sign-out UI with authenticated unregister, audible failure paths, one alert helper, memoized derivations, and a crash boundary — no success-path behavior change.

**Architecture:** Reorder-then-await; log-before-fallback; extract-and-delegate; useMemo on pure derivations; class boundary at the outlet.

**Tech Stack:** React (class boundary, hooks), vitest desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

---

### Task 1: UI-first logout

**Files:**
- Modify: `desktop/src/hooks/use-auth.ts` (logout ~288-301)
- Test: `desktop/tests/use-auth.test.tsx` (extend — read its token-capture test first, the strongest existing pattern)

Verified facts (re-confirm): logout awaits unregister BEFORE `removeSessionToken/clearUserInfo/notify`; dynamic import + cycle comment; callers fire-and-forget.

- [ ] **Step 1: Write the failing tests**

```tsx
it("updates the UI before unregister settles", async () => {
  // seed session; mock mutate to a NEVER-resolving promise (or 60s deferred);
  // call logout() WITHOUT awaiting; flush microtasks;
  // assert user signed-out (isAuthenticated false / user null) WHILE mutate still pending.
});
it("still clears storage after unregister settles", async () => {
  // mutate resolves true; await logout(); assert token cleared + flag unset.
});
```

Read the harness first: does it expose `result.current.isAuthenticated` + re-render on notify? Adapt (if notify is mocked, assert it was called synchronously before the mutate resolves).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test use-auth` (workdir: `desktop/`)
Expected: FAIL — UI updates only after unregister settles.

- [ ] **Step 3: Write minimal implementation**

```tsx
const logout = useCallback(async () => {
  // Dynamic import: a static import of ../lib/trpc here would reintroduce
  // the use-auth ↔ trpc cycle that push-unregister was created to break.
  clearUserInfo();
  notify();
  try {
    const { createTRPCClient } = await import("../lib/trpc");
    const ok = await unregisterServerToken(createTRPCClient());
    if (!ok) localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
  } catch {
    localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
  }
  removeSessionToken();
}, []);
```

Order: UI (clearUserInfo+notify) → await unregister (token still stored) → clear storage. Callers unchanged.

- [ ] **Step 4: Run to verify**

Run: `pnpm test use-auth web-push` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/hooks/use-auth.ts desktop/tests/use-auth.test.tsx
git commit -m "Fix: instant sign-out UI with authenticated unregister. TypeScript: 0 errors."
```

---

### Task 2: Audible failures

**Files:**
- Modify: `desktop/src/notifications.ts` (Tauri catch)
- Modify: `desktop/src/pages/Search.tsx` (discovery catch ~271)
- Test: `desktop/tests/settings-webtoggle.test.tsx`? No — notifications fallback has no suite yet; new `desktop/tests/send-notification.test.tsx` (mock invoke + Notification) + extend `desktop/tests/manual-add-ai.test.tsx` (empty-discovery toast case)

Verified facts (re-confirm): bare `catch { /* not Tauri */ }`; second try/catch logs; discovery catch swallows then unconditional `showToast("Added …")`; modal closes + fields reset regardless.

- [ ] **Step 1: Write the failing tests**

```tsx
// send-notification.test.tsx:
it("logs the Tauri error before web fallback", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  mockInvoke.mockRejectedValue(new Error("denied"));
  // settings webNotificationsEnabled: true (mock storage.getSettings), Notification granted;
  await sendDesktopNotification("t", "b");
  expect(err).toHaveBeenCalledWith(expect.stringContaining("[notifications]"), expect.anything());
  err.mockRestore();
});
```

Mock `../src/storage` getSettings + `../src/lib/trpc`? sendDesktopNotification imports storage + web-notifications (displayWebNotification — real one needs window.Notification; mock global Notification class like settings-webtoggle does — read that file's pattern first).

```tsx
// manual-add-ai.test.tsx append:
it("says when discovery found nothing", async () => {
  // discoverListings resolves [];
  // Add → toast "Added <name> with no listings — discovery found nothing" (exact copy TBD — use this copy);
  // modal still closes, product kept.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test send-notification manual-add-ai` (workdir: `desktop/`)
Expected: FAIL — no log; unconditional "Added".

- [ ] **Step 3: Write minimal implementation**

```ts
} catch (e) {
  console.error("[notifications] Tauri send failed, trying web display", e);
}
```

```tsx
} catch {
  // Best-effort: keep the product with no listings (today's behavior).
  discoveryFailed = true; // hmm — simpler: track found count:
}
...
showToast(found.length > 0 || !model ? `Added ${prod.name}` : `Added ${prod.name} with no listings — discovery found nothing`);
```

Careful: `found` is scoped inside `if (model)` — restructure minimally: `let discovered = 0;` before, set `discovered = found.length` after update. Keep modal-close + reset behavior identical. Exact toast copy: `Added ${prod.name} with no listings — discovery found nothing`.

- [ ] **Step 4: Run to verify**

Run: `pnpm test send-notification manual-add-ai` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/notifications.ts desktop/src/pages/Search.tsx desktop/tests/send-notification.test.tsx desktop/tests/manual-add-ai.test.tsx (verify via git status — new vs extend)
git commit -m "Fix: audible notification and discovery failures. TypeScript: 0 errors."
```

---

### Task 3: Shared alert helper

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (4 call sites: modal ~392, inline ~475, per-listing ~629, quick ~653)
- Test: `desktop/tests/best-price-signals.test.tsx` (append double-tap case — read it first)

Verified facts (re-confirm each site): permission gate (`checkNotificationPermission` + toast), `storage.addAlert({id: alert-${Date.now()}, ...})`, success toast; modal wording is the reference copy.

- [ ] **Step 1: Write the failing test** (append):

```tsx
it("creates two distinct alerts on rapid double-tap", async () => {
  // click quick-alert twice in the same ms (mock Date.now to fixed value!);
  // assert addAlert called twice with DIFFERENT ids.
});
```

`vi.spyOn(Date, "now").mockReturnValue(FIXED)` proves the random suffix (Date.now alone would collide).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test best-price-signals` (workdir: `desktop/`)
Expected: FAIL — identical ids (`alert-${Date.now()}`).

- [ ] **Step 3: Write minimal implementation** (module scope in ProductDetail.tsx — page-local, not exported; 4 sites are all in this file):

```tsx
async function createPriceAlert(input: {
  productId: string;
  distributorId: string;
  targetPrice: number;
  currency: string;
  direction: "drop" | "rise";
}): Promise<boolean> {
  const granted = await checkNotificationPermission();
  ...
}
```

Wait — `checkNotificationPermission` is component-scope (uses setAlertError? read it: it calls setAlertError in one branch? The modal path sets `setAlertError`, others toast). Unify: helper takes the check result? Simplest faithful extraction preserving each site's UX: helper does gate + addAlert + returns boolean; CALLERS keep their own error/success messaging (modal sets setAlertError, others toast). Hmm — spec says "validation/toast copy unified to the modal's wording". Read each site's exact messaging first, then unify to modal copy in the helper with per-site overrides only where the modal differs... Decision procedure (in plan, concrete): helper signature:

```tsx
async function createPriceAlert(input: {...}): Promise<{ ok: boolean; id: string }> {
  const granted = await checkNotificationPermission();
  if (!granted) return { ok: false, id: "" };
  const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await storage.addAlert({ id, productId: input.productId, direction: input.direction, distributorId: input.distributorId, targetPrice: input.targetPrice, currency: input.currency, isActive: true, createdAt: new Date().toISOString() });
  return { ok: true, id };
}
```

Callers: `const { ok } = await createPriceAlert({...}); if (!ok) { /* existing denied messaging */ return; } /* existing success messaging+toast */`. Denied messaging: unify all four to modal wording? Modal sets `setAlertError("Please enable notifications...")`, others toast "Enable notifications to receive alerts". Unify to ONE: keep each site's existing surface (modal→setAlertError, others→toast) but identical sentence? Spec says "unified to the modal's wording" — use modal's sentence everywhere, preserving each surface (error box vs toast). Read all four wordings first and normalize.

- [ ] **Step 4: Run to verify**

Run: `pnpm test best-price-signals` + any alert-modal suites (grep tests for addAlert usage — run all found); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx desktop/tests/best-price-signals.test.tsx (verify via git status)
git commit -m "Refactor: shared alert creation with unique ids. TypeScript: 0 errors."
```

---

### Task 4: Memoized derivations

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (3 IIFEs: header converter ~751, trend ~872, lowest ~890?)
- Test: none new (existing best-price/converter suites must stay green unmodified — proves no value change)

Verified facts: three inline IIFEs recompute per render; inputs are `bestListing.priceHistory/price/currency` + `displayCurrency`.

- [ ] **Step 1: Confirm green baseline**

Run: `pnpm test best-price-signals converted-row-prices nav-header` (workdir: `desktop/`)
Expected: PASS (pre-change baseline).

- [ ] **Step 2: Write minimal implementation**

```tsx
const headerConversion = useMemo(() => {
  if (!bestListing || displayCurrency === bestListing.currency) return null;
  const converted = convertPrice(bestListing.price, bestListing.currency, displayCurrency);
  if (converted === null) return null;
  const rate = convertPrice(1, bestListing.currency, displayCurrency);
  return { converted, rate };
}, [bestListing, displayCurrency]);

const trendSignal = useMemo(() => { ...existing IIFE body, returns {down, pct} | null ... }, [bestListing?.priceHistory]);
const lowestEver = useMemo(() => { ...existing body, returns boolean ... }, [bestListing]);
```

Verify `useMemo` imported; keep JSX identical (replace IIFE calls with the memoized values; null-guards preserved). Deps must cover every reactive read inside (priceHistory/price/currency/displayCurrency — `bestListing` object identity covers its fields IF the object is recreated on change... is bestListing memoized upstream? If it's a fresh object every render, useMemo on [bestListing] never hits! CHECK how bestListing is derived first — if unmemoized, key on `[bestListing?.priceHistory, bestListing?.price, bestListing?.currency, displayCurrency]` (stable primitives). This detail decides whether the memo does anything — verify before writing.)

- [ ] **Step 3: Run to verify no value change**

Run: same three suites (desktop); `pnpm check` (root, 0 errors).
Expected: PASS unmodified.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Refactor: memoize product derivations. TypeScript: 0 errors."
```

---

### Task 5: Desktop error boundary

**Files:**
- Create: `desktop/src/components/ErrorBoundary.tsx`
- Modify: `desktop/src/main.tsx` (wrap `<App />`)
- Test: `desktop/tests/error-boundary.test.tsx` (new)

Verified facts (re-confirm): main.tsx renders `<App/>` in StrictMode, no boundary; mobile copy in `components/route-error-boundary.tsx` (message + retry).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function Boom() { throw new Error("boom"); }

describe("error boundary", () => {
  it("renders fallback on child crash", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });
  it("recovers on retry", async () => {
    // render with a toggled child (throw then healthy); click Retry/Try again; assert healthy content.
  });
});
```

Suppress React's error logging in tests (console.error mock + restore). Copy mobile fallback copy verbatim ("We couldn't load this screen" + "Your data is safe" — read the exact strings first).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test error-boundary` (workdir: `desktop/`)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Component, type ReactNode } from "react";
import { useNavigate } from "react-router"; // NO — boundary is OUTSIDE the router (wraps App in main.tsx). Retry = state reset only, no navigate. (If placed inside router instead... main.tsx wraps App which CONTAINS HashRouter — boundary must be outside to catch router crashes. So: reset-only retry. Document this.)
```

```tsx
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error): void {
    console.error("[boundary] render crash", error);
  }
  private reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div role="alert" ...tailwind centered...>
          <p>We couldn&apos;t load this screen</p>
          <p>Something unexpected happened. Your data is safe — try again.</p>
          <button onClick={this.reset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

main.tsx: `<ErrorBoundary><App /></ErrorBoundary>` (StrictMode kept outside or inside? `<StrictMode><ErrorBoundary><App/></ErrorBoundary></StrictMode>` — keep StrictMode outermost, wrap App).

- [ ] **Step 4: Run to verify**

Run: `pnpm test error-boundary` (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/ErrorBoundary.tsx desktop/src/main.tsx desktop/tests/error-boundary.test.tsx
git commit -m "Feat: desktop error boundary. TypeScript: 0 errors."
```

---

### Final verification (all tasks)

```bash
pnpm check          # expect: 0 errors
pnpm lint           # expect: 0 errors
pnpm test           # expect: 0 failures (root)
pnpm test           # workdir desktop/ — expect: 0 failures
pnpm build          # workdir desktop/ — expect: exit 0
```

Do NOT push. Report DONE (per-task outcome + verification counts) or BLOCKED/NEEDS_CONTEXT.
