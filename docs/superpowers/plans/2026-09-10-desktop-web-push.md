# Desktop Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Closed-app push delivery for desktop web/PWA by wiring the existing server pipeline: desktop-hosted service worker, subscribe/upload module, Settings opt-in toggle.

**Architecture:** Zero server changes (send path live: `server/notifications/evaluate.ts` + `index.ts:133` → `sendPushForUser/Device` → web tokens via VAPID). Desktop adds `desktop/public/sw.js`, `desktop/src/lib/web-push.ts`, and a toggle row reusing the section's switch styling. Signed-in only (endpoint protected).

**Tech Stack:** Service Worker + Push API, VAPID (`VITE_VAPID_PUBLIC_KEY`), tRPC (`notifications.registerPushToken`), vitest desktop + root guards, `pnpm check`, `pnpm lint`.

---

### Task 1: Desktop service worker

**Files:**
- Create: `desktop/public/sw.js`
- Test: `tests/desktop-sw-guard.test.ts` (new root string-guard)

Verified facts (re-confirm): `desktop/` has NO `public/` dir and vite.config has no `publicDir` override → default `desktop/public/` is served at `/` (verify by building and checking `dist/sw.js` exists). Copy ONLY the `push` + `notificationclick` handlers from `public/sw.js:61-100` — NOT the Expo precache block (wrong asset URLs for desktop; precache explicitly out of scope).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop service worker", () => {
  it("handles push and notificationclick without app-specific precache", async () => {
    const text = await readFile("desktop/public/sw.js", "utf8");
    expect(text).toContain('addEventListener("push"');
    expect(text).toContain('addEventListener("notificationclick"');
    expect(text).toContain("showNotification");
    expect(text).not.toContain("precache");
    expect(text).not.toContain("_expo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/desktop-sw-guard.test.ts` (repo root)
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write minimal implementation** — `desktop/public/sw.js`: the two handlers copied verbatim from `public/sw.js:61-100` (push: parse `event.data.json()` safely, skip `showNotification` when a window is focused, post `web-push-shown` to clients; notificationclick: close, focus existing client or `openWindow("/")`). No precache/install/activate/fetch handlers.

- [ ] **Step 4: Run test + build to verify**

Run: `pnpm vitest run tests/desktop-sw-guard.test.ts` (root, PASS); `pnpm build` (workdir `desktop/`, exit 0) then verify `dist/sw.js` exists (`ls dist/sw.js`).
Expected: PASS + file served.

- [ ] **Step 5: Commit**

```bash
git add desktop/public/sw.js tests/desktop-sw-guard.test.ts
git commit -m "Feat: desktop push service worker. TypeScript: 0 errors."
```

---

### Task 2: Subscribe + upload module

**Files:**
- Create: `desktop/src/lib/web-push.ts`
- Test: `desktop/tests/web-push.test.ts` (new)

Verified facts (re-confirm): `lib/web-push.ts` imports RN `Platform` + mobile `./trpc` → NOT importable from desktop; mirror its logic instead. Desktop tRPC: `createTRPCClient` from `./trpc` (same dir) then `client.notifications.registerPushToken.mutate({token, platform: "web"})` (input: token 1-2048 chars, platform enum incl. "web"; protected; device derived server-side — no deviceId needed). VAPID key: `import.meta.env.VITE_VAPID_PUBLIC_KEY` (vite `envPrefix: ["VITE_","TAURI_"]` — `EXPO_PUBLIC_*` is NOT visible; verify). Permission helper: `requestWebNotificationPermission` from `../../../lib/web-notifications` (Settings.tsx uses it — copy the specifier).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPushSupported, ensurePushSubscription, disablePush } from "../src/lib/web-push";

const mockMutate = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({ notifications: { registerPushToken: { mutate: mockMutate } } }),
}));

function setSupport(partial: Record<string, unknown>) {
  Object.assign(window, { PushManager: undefined, Notification: undefined });
  Object.assign(navigator, { serviceWorker: undefined });
  Object.assign(window, partial.sw ?? {});
  Object.assign(navigator, partial.nav ?? {});
}

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("desktop web push", () => {
  it("reports unsupported without serviceWorker/PushManager", () => {
    setSupport({});
    expect(isPushSupported()).toBe(false);
  });
  it("subscribes and uploads the subscription", async () => {
    const subscribe = vi.fn().mockResolvedValue({ endpoint: "https://push/x", toJSON: () => ({}) });
    const registration = { pushManager: { subscribe } };
    Object.assign(window, { PushManager: function () {} });
    Object.assign(navigator, { serviceWorker: { register: vi.fn().mockResolvedValue(registration), getRegistration: vi.fn().mockResolvedValue(registration) } });
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BMx-test-key");
    const ok = await ensurePushSubscription();
    expect(ok).toBe(true);
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ platform: "web" }));
  });
  it("refuses without a VAPID key", async () => {
    Object.assign(window, { PushManager: function () {} });
    Object.assign(navigator, { serviceWorker: {} });
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    await expect(ensurePushSubscription()).resolves.toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
  });
  it("disables by unsubscribing", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    Object.assign(navigator, { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) } }) } });
    await disablePush();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

Adapt ONLY as jsdom demands (verify `vi.stubEnv` works with vite env in desktop vitest; if `import.meta.env` is frozen, set the key via the module's documented seam — e.g. accept an optional param? NO — keep `import.meta.env` and confirm stubEnv works; if it doesn't, report NEEDS_CONTEXT rather than redesigning).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test web-push` (workdir: `desktop/`)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop/src/lib/web-push.ts
import { createTRPCClient } from "./trpc";

export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof window.Notification !== "undefined"
  );
}

function vapidKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensurePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const key = vapidKey();
  if (!key) return false;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    const registration = existing ?? (await navigator.serviceWorker.register("/sw.js"));
    if (!registration) return false;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
    const client = createTRPCClient();
    await client.notifications.registerPushToken.mutate({
      token: JSON.stringify(subscription),
      platform: "web",
    });
    return true;
  } catch (e) {
    console.error("[web-push] subscribe failed", e);
    return false;
  }
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (e) {
    console.error("[web-push] unsubscribe failed", e);
  }
}
```

Mirror `lib/web-push.ts` semantics (warn vs error: mobile uses console.warn; desktop convention from share module is silent-bool + caller toast — use `console.error` per error-paths convention; either is fine, pick error and stay consistent within the file). Server-side prune on disable: `pruneDeviceToken` exists — check its trigger (sign-out? device delete?) at implementation; if sign-out already prunes, no extra call needed — note it in the commit message either way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test web-push` (workdir: `desktop/`); `pnpm check` (root, 0 errors).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib/web-push.ts desktop/tests/web-push.test.tsx
git commit -m "Feat: desktop push subscription module. TypeScript: 0 errors."
```

---

### Task 3: Settings push toggle

**Files:**
- Modify: `desktop/src/pages/Settings.tsx` (Notifications section ~1188, after Price Alerts row or near Test notification — read and place)
- Test: `desktop/tests/settings-push.test.tsx` (new; check for an existing Settings render harness — pages.test.tsx Settings trio exists; copy it)

Verified facts (re-confirm): section uses peer-checked switch rows with `aria-label`s; `useAuth()` gives `isAuthenticated`; `showToast` in scope (toast div pattern); permission helper `requestWebNotificationPermission` + `isWebNotificationsSupported`? (Settings uses `isWebNotificationsSupported()` at :250 — copy its import).

- [ ] **Step 1: Write the failing tests**

```tsx
vi.mock("../src/lib/web-push", () => ({
  isPushSupported: vi.fn().mockReturnValue(true),
  ensurePushSubscription: vi.fn(),
  disablePush: vi.fn(),
}));
import { isPushSupported, ensurePushSubscription, disablePush } from "../src/lib/web-push";

it("enables push with permission + toast", async () => {
  // render Settings signed-in; click "Enable push notifications"; assert ensurePushSubscription called; success toast shown.
});
it("stays disabled with reason when signed out", async () => {
  // render Settings signed-out; toggle disabled; "Sign in to enable push" visible; ensurePushSubscription not called.
});
it("surfaces subscribe failure", async () => {
  vi.mocked(ensurePushSubscription).mockResolvedValue(false);
  // click; assert failure toast ("Couldn't enable push notifications").
});
```

Mock `use-auth` for signed-in/out states (check how settings-connection.test.tsx mocks it — copy). Permission: real `requestWebNotificationPermission` calls `Notification.requestPermission` — mock `../lib/...`? It's imported from `../../../lib/web-notifications` (root lib) — mock that module too OR mock `window.Notification.requestPermission = vi.fn().mockResolvedValue("granted")`. Prefer the latter (tests the real integration); fall back to module mock if jsdom fights.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test settings-push` (workdir: `desktop/`)
Expected: FAIL — no push row.

- [ ] **Step 3: Write minimal implementation** — new row after Price Alerts (match switch styling; use a button-style row since it's async, NOT a checkbox — a checkbox implies instant local state; async subscribe needs pending state):

```tsx
const [pushState, setPushState] = useState<"unknown" | "on" | "off">("unknown");
const [pushBusy, setPushBusy] = useState(false);
const [pushReason, setPushReason] = useState<string | null>(null);

// on mount (signed-in only): detect current status —
// query existing subscription: needs a module fn! Add `getPushStatus(): Promise<"on"|"off">` to web-push.ts (getRegistration → getSubscription → boolean).
// If Task 2 didn't include it, add it here with a unit test (small, same file).
```

Status detection on mount: `useEffect(() => { if (!isAuthenticated || !isPushSupported()) { setPushState("off"); setPushReason(...); return; } void getPushStatus().then(s => { setPushState(s); if (s === "off") setPushReason(null); }); }, [isAuthenticated]);` Reasons: unsupported → "Push isn't available in this browser"; no VAPID key → "Push isn't configured on this server" (detect via a `hasVapidKey()` export? — expose tiny helper or reuse: `ensurePushSubscription` returns false ambiguously. Add `getPushAvailability(): "ok"|"unsupported"|"no-key"` to the module? Keep it lean: module exports `isPushSupported()` + `hasVapidKey()` (one-liner reading env) + `getPushStatus()`; Settings composes reasons. Add unit tests for the two tiny helpers in web-push.test.tsx (extend Task 2's file — allowed: same feature).

Enable handler:

```tsx
const handleEnablePush = async () => {
  if (pushBusy) return;
  setPushBusy(true);
  try {
    const permission = await requestWebNotificationPermission();
    if (permission !== "granted") { showToast("Notification permission not granted"); return; }
    const ok = await ensurePushSubscription();
    if (ok) { setPushState("on"); setPushReason(null); showToast("Push notifications enabled"); }
    else { showToast("Couldn't enable push notifications"); }
  } finally {
    setPushBusy(false);
  }
};
```

Disable: `await disablePush(); setPushState("off"); showToast("Push notifications disabled");`

Row UI (match section styling, button not checkbox):

```tsx
<div className="flex items-center justify-between ...">
  <span>
    <span className="block text-sm font-medium">Push notifications</span>
    <span className="block text-xs text-gray-500 dark:text-gray-400">
      {pushState === "on" ? "On — alerts arrive even with the app closed." : pushReason ?? "Off"}
    </span>
  </span>
  <button onClick={pushState === "on" ? handleDisablePush : handleEnablePush} disabled={pushBusy || (!isAuthenticated && pushState !== "on")} aria-label={pushState === "on" ? "Disable push notifications" : "Enable push notifications"}>
    {pushBusy ? "Working" : pushState === "on" ? "Disable" : "Enable"}
  </button>
</div>
{!isAuthenticated && <p ...>Sign in to enable push</p>}
```

Signed-out: `isPushSupported` may still be true but upload would 401 — gate: if (!isAuthenticated) show reason "Sign in to enable push" and disable. Compose reason priority: !isAuthenticated → sign-in; !supported → browser; !key → server; else off.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test settings-push web-push` (workdir: `desktop/`); `pnpm check` (root, 0 errors); `pnpm build` (workdir: `desktop/`, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Settings.tsx desktop/tests/settings-push.test.tsx desktop/src/lib/web-push.ts desktop/tests/web-push.test.tsx
git commit -m "Feat: push notification opt-in on desktop. TypeScript: 0 errors."
```

(Stage web-push files only if the status helpers were added in this task; verify via `git status`.)

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

**Manual QA note (cannot run headless — document in report):** real end-to-end (SW registration, VAPID subscribe, closed-app delivery) needs a real browser over HTTPS with `VITE_VAPID_PUBLIC_KEY` set; headless Chromium has no push service. Flag this in the final report.
