# Product Polish Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six mobile-parity items on desktop — best-price signals, AI manual-add, web-notifications toggle with display fallback, tab sync, stats CTA, converter/payment lines.

**Architecture:** Mirror mobile logic/copy; desktop rendering stack; no polling or expo-push entanglement; existing error taxonomy + storage reused.

**Tech Stack:** React + react-router, `discoverProduct`/`discoverListings` (`lib/`), vitest desktop (`desktop/ pnpm test`), `pnpm check`, `pnpm lint`.

**Known mobile discrepancy (flagged, not mirrored):** the quick-alert button labels −5% but creates at full price (`app/product/[id].tsx` vs `best-distributor-card.tsx`). Desktop creates at the labeled −5% (self-consistent). Fix mobile separately — out of scope.

---

### Task 1: Best-price signals

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (Best Price card ~806-866)
- Test: `desktop/tests/best-price-signals.test.tsx` (new; check for an existing ProductDetail harness — converted-row/insight-skeleton render at /product/p1 — copy cheapest)

Verified facts (re-confirm): card has `best` (`{price, currency}` via getBestPrice), `bestListing` (priceHistory/currency/distributorId/url/stockStatus), `bestDistributor` (name/country/countryFlag), `product`; NO trend/best-ever/quick-alert yet; `formatPrice`/`convertPrice` in scope; `storage.addAlert` shape at :392-400 (id/productId/direction/distributorId/targetPrice/currency/isActive/createdAt) with permission gate (`checkNotificationPermission`) + `showToast`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows trend and lowest-ever signals", async () => {
  // bestListing history [100 USD older, 90 USD now] → "▼ 10%" + "Lowest Price Ever" visible.
  // history [90, 100] → "▲ 11%" visible, no banner.
  // single-point history → neither.
});
it("creates a −5% alert in one tap", async () => {
  // click `Set Alert at $X (−5%)`; assert storage.addAlert called with targetPrice ≈ price*0.95 (rounded to cents like mobile: Math.round(p*0.95*100)/100), distributorId + currency of bestListing; toast shown.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test best-price-signals` (workdir: `desktop/`)
Expected: FAIL — none of the three exist.

- [ ] **Step 3: Write minimal implementation** (inside the Best Price card, after distributor line, before Buy button):

```tsx
{(() => {
  const hist = bestListing.priceHistory;
  if (!hist || hist.length < 2) return null;
  const sorted = [...hist].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const oldest = sorted[0].price, current = sorted[sorted.length - 1].price;
  if (current === oldest) return null;
  const pct = Math.round(Math.abs(oldest - current) / oldest * 100);
  const down = current < oldest;
  return <p className="...">{down ? "▼" : "▲"} {pct}%</p>;
})()}
```

Copy mobile thresholds exactly (≥2 points, oldest-vs-current, Math.round). Banner:

```tsx
{(() => {
  const priorMin = Math.min(...bestListing.priceHistory.slice(0, -1).map((p) => convertPrice(p.price, p.currency, "USD") ?? Infinity));
  const currentUsd = convertPrice(bestListing.price, bestListing.currency, "USD");
  if (currentUsd === null) return null;
  return currentUsd < priorMin ? <p className="...">Lowest Price Ever</p> : null;
})()}
```

Styling: tailwind matching card idiom (emerald tint; read neighboring classes — no new design language). Quick-alert button:

```tsx
const handleQuickAlert = async () => {
  if (!product || !bestListing) return;
  const granted = await checkNotificationPermission();
  if (!granted) { showToast("Enable notifications to receive alerts"); return; }
  const suggested = Math.round(bestListing.price * 0.95 * 100) / 100;
  await storage.addAlert({ id: `alert-${Date.now()}`, productId: product.id, direction: "drop", distributorId: bestListing.distributorId, targetPrice: suggested, currency: bestListing.currency, isActive: true, createdAt: new Date().toISOString() });
  showToast(`Alert set at ${formatPrice(suggested, bestListing.currency)}`);
};
```

Verify `direction: "drop"` matches the file's alert-direction values (`"drop"|"rise"` — yes :123). Button label verbatim mobile: `Set Alert at {formatPrice(suggested, currency)} (−5%)`, aria-label likewise.

- [ ] **Step 4: Run to verify**

Run: `pnpm test best-price-signals` (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx desktop/tests/best-price-signals.test.tsx
git commit -m "Feat: best-price trend, lowest-ever, quick alert. TypeScript: 0 errors."
```

---

### Task 2: AI manual-add

**Files:**
- Modify: `desktop/src/pages/Search.tsx` (manual modal ~381-394, `handleManualAdd` ~229)
- Test: `desktop/tests/manual-add-ai.test.tsx` (new)

Verified facts (re-confirm): `handleManualAdd` creates `{id: manual-${Date.now()}, listings: [], ...}` from 4 fields; modal is inline JSX (not a component); `discoverProduct` (server POST, throws DiscoveryAuthError/DiscoveryError) + `discoverListings(model, opts)` (`lib/`) — verify BOTH import cleanly in desktop (no RN imports: llm-discovery imports `@/lib/storage` defaultStorage + `@/constants/oauth` — check those resolve under vite (oauth constants = env reads, fine; defaultStorage = AsyncStorage → vite stub; BUILD proves it); the existing `toDiscoverErrorState` import in SearchModal proves llm-discovery already bundles on desktop — VERIFY that import exists (grep) and if so, no new import risk).

- [ ] **Step 1: Write the failing tests**

```tsx
it("parses pasted text then discovers listings", async () => {
  // mock discoverProduct → {name, modelNumber, brand, category};
  // type into paste box, click Parse → fields fill;
  // mock discoverListings → 2 listings with progress calls;
  // click Add → storage.addToWatchlist called with listings length 2 + trackedIds updated.
});
it("falls back to the plain form on parse failure", async () => {
  // discoverProduct rejects DiscoveryError("server"); plain fields still work; Add creates listings: [].
});
it("shows auth guidance on DiscoveryAuthError", async () => {
  // discoverProduct rejects DiscoveryAuthError → "Sign-in Required" (reuse toDiscoverErrorState rendering already on page? SearchModal has it; Search.tsx? — verify and mirror whichever exists).
});
```

Mock `../../../lib/llm-discovery` + `../../../lib/listing-discovery` (verify depths from Search.tsx — same as SearchModal's proven imports; copy specifiers).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test manual-add-ai` (workdir: `desktop/`)
Expected: FAIL — no paste/parse/discover UI.

- [ ] **Step 3: Write minimal implementation** — extend the manual modal (keep the 4 plain fields as the review step):

```tsx
const [pasteText, setPasteText] = useState("");
const [parsing, setParsing] = useState(false);
const [discovering, setDiscovering] = useState(false);
const [discoverProgress, setDiscoverProgress] = useState<{done: number; total: number} | null>(null);
const [discoverError, setDiscoverError] = useState<ErrorState | null>(null);

const handleParse = async () => {
  if (!pasteText.trim()) return;
  setParsing(true); setDiscoverError(null);
  try {
    const parsed = await discoverProduct(pasteText.trim());
    setManualName(parsed.name ?? ""); setManualModel(parsed.modelNumber ?? "");
    setManualBrand(parsed.brand ?? ""); setManualCategory(parsed.category ?? "");
  } catch (e) {
    setDiscoverError(toDiscoverErrorState(e)); // verify this helper + shape used on desktop already
  } finally { setParsing(false); }
};
```

Verify `discoverProduct` input/return shape first (`discoverProduct(query): {name, modelNumber, brand?, category?}`? — read its signature + the mobile sheet's usage). `handleManualAdd`: after creating the product, if `manualModel` non-empty → `discoverListings(model, {onProgress})` → `storage.updateProductListings(id, found)`? (verify updateProductListings exists on desktop storage — YES, used by seed backfill). On discovery failure: keep product with `[]` + toast (fallback = today's behavior). Progress text `{done}/{total}`.

UI: paste textarea + Parse button above the 4 fields; error box with Retry (mirror SearchModal's discovery error rendering); Add button shows "Discovering…" while running. Keep styling consistent with the modal.

- [ ] **Step 4: Run to verify**

Run: `pnpm test manual-add-ai` (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0 — proves new lib imports bundle-clean).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Search.tsx desktop/tests/manual-add-ai.test.tsx
git commit -m "Feat: AI-assisted manual add on desktop. TypeScript: 0 errors."
```

---

### Task 3: Web-notifications toggle + fallback

**Files:**
- Modify: `desktop/src/pages/Settings.tsx` (Notifications section ~1239+, after Push row or near Test — read and place)
- Modify: `desktop/src/notifications.ts` (sendDesktopNotification fallback)
- Test: `desktop/tests/settings-webtoggle.test.tsx` (new; check settings-push harness — copy)

Verified facts (re-confirm): NO `webNotificationsEnabled` on desktop (sweep grep); desktop storage = shared factory → setting key exists in type + mobile defaults; `displayWebNotification` in `../../../lib/web-notifications` (check desktop-import safety: file imports RN Platform + mobile storage/singletons — importing the MODULE pulls those! Import ONLY the function? ES import pulls the module graph... vite build would include RN Platform — does that break desktop build? `lib/web-notifications` also imports expo push paths (syncPushSubscription). DANGER. Resolve in planning: OPTION A — import { displayWebNotification } and prove build-clean; OPTION B — inline the ~10-line Notification-API display in notifications.ts (no new imports). Prefer B unless A proves clean (smaller entanglement surface; the function is trivial). Decide by attempting A first, fall back to B on build failure — report which.)

Mobile copy (verbatim): label "Web Notifications", description "Show price and stock alerts in your browser", hints: denied → "Notifications are blocked in your browser settings.", else → "Allow notifications in your browser to receive alerts."

- [ ] **Step 1: Write the failing tests**

```tsx
it("toggles web notifications with permission flow", async () => {
  // signed-in Settings; Notification.requestPermission mocked granted;
  // click Enable (aria-label "Enable web notifications"); assert storage.saveSettings called with webNotificationsEnabled: true; hint absent.
});
it("shows the blocked hint when denied", async () => {
  // requestPermission → "denied"; click; assert blocked-hint text + setting stays false.
});
it("falls back to web display when Tauri is absent and setting is on", async () => {
  // mock invoke to reject (no Tauri), Notification.requestPermission granted + setting on;
  // call sendDesktopNotification; assert window.Notification displayed (spy on Notification constructor? jsdom has no Notification — mock global Notification class, assert `new` called with title).
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test settings-webtoggle` (workdir: `desktop/`)
Expected: FAIL — no toggle row.

- [ ] **Step 3: Write minimal implementation**

Settings row (match switch-row styling of neighboring toggles; read one first — if rows use a shared SwitchRow component, use it):

```tsx
// state: webNotifEnabled (from settings), webNotifHint
const handleWebToggle = async (v: boolean) => {
  if (v) {
    const permission = await requestWebNotificationPermission(); // verify import source in Settings (already used for test button — copy specifier)
    const enabled = permission === "granted";
    await storage.saveSettings({ ...(await storage.getSettings()), webNotificationsEnabled: enabled });
    setWebNotifHint(!enabled ? (permission === "denied" ? "Notifications are blocked in your browser settings." : "Allow notifications in your browser to receive alerts.") : null);
  } else {
    ... save false, clear hint ...
  }
};
```

Verify settings read-modify-write pattern used elsewhere in Settings (don't clobber other keys — read how other toggles save first and copy).

notifications.ts fallback:

```ts
export async function sendDesktopNotification(title: string, body: string, route?: string): Promise<void> {
  try {
    await invoke("send_notification", { title, body, sound: true, route: route ?? null });
    return;
  } catch { /* not Tauri — try web display */ }
  try {
    const settings = await storage.getSettings(); // verify storage import path in notifications.ts (it imports invoke only now — check what storage it can use: desktop ../storage? notifications.ts is in src/ → ./storage. Verify factory has getSettings — yes.)
    if (!settings?.webNotificationsEnabled) return;
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    new window.Notification(title, { body });
  } catch (e) {
    console.error("Failed to send notification:", e);
  }
}
```

Route on web: web Notification without click-routing (sw.js handles push clicks; local web notifications onclick → focus? keep minimal: no click handler in v1 — document in report. Hmm, spec says "display fallback" only — OK.)

- [ ] **Step 4: Run to verify**

Run: `pnpm test settings-webtoggle` (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Settings.tsx desktop/src/notifications.ts desktop/tests/settings-webtoggle.test.tsx
git commit -m "Feat: web notification toggle and display fallback. TypeScript: 0 errors."
```

---

### Task 4: Navigation + header parity

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx` (tab sync effect)
- Modify: `desktop/src/pages/Watchlist.tsx` (summary CTA)
- Modify: `desktop/src/pages/ProductDetail.tsx` (header converter + payment line)
- Test: extend `desktop/tests/ux-alignment.test.tsx`? (has Alerts harness + searchParams?) — else new `desktop/tests/nav-header.test.tsx`. Decide by reading harnesses first (cheapest wins).

Verified facts (re-confirm): tab state `useState` from `searchParams.get("tab")` (consistency Task 3); Watchlist summary block ~902-935 (no /stats link); header ~712-746 (no converter); best card has `best` + `displayCurrency` + `bestDistributor.paymentMethods`? (verify distributor type has paymentMethods on desktop — mobile `distributor.paymentMethods`; desktop `bestDistributor` from getDistributorById — same shared type, verify).

- [ ] **Step 1: Write the failing tests**

```tsx
it("syncs tab when the query changes", async () => {
  // render at /alerts?tab=alerts; rerender/navigate to /alerts?tab=reminders (same mounted component — use MemoryRouter + navigate, NOT remount);
  // assert reminders content visible.
});
it("links summary to stats", async () => {
  // watchlist summary shows "View statistics" href /stats.
});
it("shows converted best price and payment methods", async () => {
  // ProductDetail with EUR listing + USD display: header shows converted best + "1 EUR = X USD"-style rate line; payment line when distributor has methods.
});
```

Rate-line format verbatim mobile (`product-info-card.tsx:65-104` — read exact format first, e.g. `1 EUR = 1.08 USD`).

- [ ] **Step 2: Run to verify they fail**

Run: chosen suite(s) (workdir: `desktop/`)
Expected: FAIL — stale tab, no CTA, no converter.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Alerts.tsx — after tab state declaration:
const [searchParams] = useSearchParams(); // already declared? (consistency Task 3 added it — reuse the SAME binding, do not redeclare)
useEffect(() => {
  const t = searchParams.get("tab");
  setTab(t === "reminders" ? "reminders" : t === "notifications" ? "notifications" : "alerts");
}, [searchParams]);
```

Wait — consistency review noted `?tab=notifications` falls back to alerts; spec now says notifications addressable. Include the third arm (spec §D overrides the old fallback). Verify Tab type includes "notifications" (review said `"alerts"|"reminders"|"notifications"` — yes).

```tsx
// Watchlist summary: <Link to="/stats" aria-label="View statistics">View statistics</Link> (style like neighboring /distributor-analysis link at :853 — copy).
```

```tsx
// ProductDetail header (after description or near best card — mirror mobile placement: product-info-card shows converted best under header; put under the description):
{displayCurrency !== best.currency && (
  <p className="mt-1 text-sm ...">{formatPrice(best.price, best.currency)} ≈ {formatPrice(convertPrice(best.price, best.currency, displayCurrency) ?? best.price, displayCurrency)}</p>
)}
{rate line + paymentMethods line verbatim mobile copy}
```

Read mobile `product-info-card.tsx:65-104` + `best-distributor-card.tsx:260-264` first and mirror copy exactly (rate format, 💳 prefix).

- [ ] **Step 4: Run to verify**

Run: chosen suite(s) (desktop); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx desktop/src/pages/Watchlist.tsx desktop/src/pages/ProductDetail.tsx <test files> (verify via git status)
git commit -m "Feat: tab sync, stats CTA, header converter. TypeScript: 0 errors."
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
