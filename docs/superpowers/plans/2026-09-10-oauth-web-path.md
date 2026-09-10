# OAuth Web Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAuth sign-in works in desktop web/PWA via the existing ticket model: server redirects tickets to web callback URLs, desktop adds the callback route that redeems them.

**Architecture:** 2-line-class server change (ticket redirect target) + desktop callback page reusing `lib/oauth-callback.ts` (zero imports — browser-safe) and existing session storage. No cookie/CORS work, no Bearer changes, Tauri path untouched.

**Tech Stack:** Express OAuth (`server/_core/oauth.ts`), React Router (`desktop/src/App.tsx`, HashRouter), vitest root + desktop, `pnpm check`, `pnpm lint`.

---

### Task 1: Server ticket redirect to web URLs

**Files:**
- Modify: `server/_core/oauth.ts` (native ticket branch ~line 514-519)
- Test: `tests/oauth-handlers.test.ts` (extend — read it first for the existing scheme-redirect test shape)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): branch is
```ts
if (isNative) {
  const ticket = issueOAuthTicket(openId, state.deviceId);
  const params = new URLSearchParams({ ticket });
  res.redirect(302, `productstockfinder:/oauth/callback?${params.toString()}`);
  return;
}
```
with `isNative = Boolean(state.deviceId) || state.redirectUri.startsWith("productstockfinder:")`, `resolveSafeRedirectUri` + `webBase` in scope. Existing tests in `tests/oauth-handlers.test.ts` (+ `oauth-state`, `oauth-exchange`) assert scheme redirects — read them first and keep them passing.

- [ ] **Step 1: Write the failing test** (append to `tests/oauth-handlers.test.ts`, matching its harness — read first for how it builds signed state + invokes the callback handler):

```ts
it("redirects the ticket to a same-origin web redirectUri", async () => {
  // build state with redirectUri: `${webBase}/#/oauth/callback` (+ deviceId),
  // drive GET /api/oauth/callback with a valid code (copy the existing test's
  // code-exchange mocking approach), then:
  // expect(redirectLocation).toContain("/#/oauth/callback?ticket=");
  // expect(redirectLocation).not.toContain("productstockfinder:");
});
```

The exact harness depends on the file (mocked `exchangeGoogleCode`? mocked db/sdk?). Copy the nearest existing success-path test and change only the state's redirectUri. If the harness makes this impractical, say so → NEEDS_CONTEXT (do not invent a parallel harness that bypasses rate-limit/state checks).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/oauth-handlers.test.ts` (repo root)
Expected: FAIL — redirect goes to `productstockfinder:` scheme.

- [ ] **Step 3: Write minimal implementation**

```ts
if (isNative) {
  const ticket = issueOAuthTicket(openId, state.deviceId);
  const safeRedirect = resolveSafeRedirectUri(state.redirectUri, webBase);
  if (safeRedirect.startsWith("http://") || safeRedirect.startsWith("https://")) {
    const sep = safeRedirect.includes("?") ? "&" : "?";
    res.redirect(302, `${safeRedirect}${sep}ticket=${encodeURIComponent(ticket)}`);
    return;
  }
  const params = new URLSearchParams({ ticket });
  res.redirect(302, `productstockfinder:/oauth/callback?${params.toString()}`);
  return;
}
```

Why safe: `resolveSafeRedirectUri` already gates http(s) targets to `webBase` origin (else falls back to `"/"` → scheme branch, unchanged behavior). Ticket stays device-bound/single-use; target sanitized at state creation and re-validated here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/oauth-handlers.test.ts tests/oauth-state.test.ts tests/oauth-exchange.test.ts` (root)
Expected: PASS — old scheme tests + new web test.

- [ ] **Step 5: Commit**

```bash
git add server/_core/oauth.ts tests/oauth-handlers.test.ts
git commit -m "Feat: redirect OAuth tickets to web callback URLs. TypeScript: 0 errors."
```

---

### Task 2: Desktop web login + callback route

**Files:**
- Modify: `desktop/src/hooks/use-auth.ts` (`buildLoginUrl` area ~48-58, `login` ~211-258)
- Create: `desktop/src/pages/OAuthCallback.tsx`
- Modify: `desktop/src/App.tsx` (add `/oauth/callback` route before `*`)
- Test: `desktop/tests/oauth-callback.test.tsx` (new) + extend `tests/desktop-oauth-portal.test.ts`? No — root guard asserts portal URL shape; check whether it constrains `redirectUri` (read it first; if it asserts localhost:3420, extend carefully). Primary coverage is the desktop behavioral test.

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch):
- `buildLoginUrl()` builds portal URL with hardcoded `redirectUri http://localhost:3420/callback`, no deviceId. `getDesktopDeviceId()` (async) in `desktop/src/lib/device-id.ts:15`. Portal accepts `deviceId` query param (server reads `req.query.deviceId`).
- `login(loginUrl)` does `invoke("start_oauth", { loginUrl })`, stores token via `setSessionToken`, user via `setUserInfo(mapUser(decoded))`, `notify()`. `mapUser` accepts `{id?, openId?, name?, email?, emailVerified?, loginMethod?, lastSignedIn?}`.
- Tauri detection precedent: `typeof window !== "undefined" && (window as any).__TAURI__` (Settings.tsx:526).
- `lib/oauth-callback.ts` has ZERO imports (pure + fetch) — safe to import from desktop via `../../../lib/oauth-callback` (same depth as SearchModal's `../../../lib/llm-discovery`).
- Consume endpoint `POST {apiBase}/api/auth/oauth/consume` takes `{ticket, deviceId}`, returns `{sessionToken, user}` (`buildUserResponse` shape incl. `emailVerified`).
- App route table at App.tsx:332-352; insert `/oauth/callback` before `path="*"`.
- `getApiBaseUrl()` from `../lib/api-base` (use-auth:127 uses it).

- [ ] **Step 1: Write the failing tests** (`desktop/tests/oauth-callback.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../lib/oauth-callback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/oauth-callback")>();
  return { ...actual, redeemOAuthTicket: vi.fn() };
});
import { redeemOAuthTicket } from "../../../lib/oauth-callback";

import { OAuthCallback } from "../src/pages/OAuthCallback";

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe("oauth callback", () => {
  it("redeems the ticket and signs in", async () => {
    vi.mocked(redeemOAuthTicket).mockResolvedValue({
      sessionToken: "sess-123",
      user: { id: 7, openId: "google:abc", name: "Test", email: "t@e.com", emailVerified: true },
    });
    renderAt("/oauth/callback?ticket=tick-1");
    await waitFor(() => expect(redeemOAuthTicket).toHaveBeenCalledWith("tick-1", expect.objectContaining({})));
    await waitFor(() => expect(localStorage.getItem("psf_session_token") ?? localStorage.getItem("session_token")).not.toBeNull());
    await waitFor(() => expect(screen.getByText("Home")).toBeInTheDocument());
  });
  it("shows provider errors without redeeming", async () => {
    renderAt("/oauth/callback?error=access_denied&error_description=Nope");
    await waitFor(() => expect(screen.getByText(/nope/i)).toBeInTheDocument());
    expect(redeemOAuthTicket).not.toHaveBeenCalled();
  });
});
```

Adjustments allowed ONLY as needed: verify `SESSION_TOKEN_KEY`'s actual localStorage key (read use-auth top — do NOT guess `"psf_session_token"`; assert via the real constant or `getSessionToken()` return), verify `OAuthCallback` needs no extra providers (no toast/query deps — keep the page dependency-free: use `useNavigate` + local error state only, mirror mobile states). `useSearchParams` from `react-router` reads `?ticket=` inside the hash route (`#/oauth/callback?ticket=` → search params work).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test oauth-callback` (workdir: `desktop/`)
Expected: FAIL — `../src/pages/OAuthCallback` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// desktop/src/pages/OAuthCallback.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { parseOAuthCallbackParams, redeemOAuthTicket } from "../../../lib/oauth-callback";
import { getApiBaseUrl } from "../lib/api-base";
import { getDesktopDeviceId } from "../lib/device-id";
// session storage: setSessionToken, setUserInfo (+ mapUser if exported) from "../hooks/use-auth" — verify exports on read.
```

`mapUser` is module-private in use-auth (verify on read; if not exported, either export it — one-line change, no logic change — or replicate mobile's normalization inline per `app/oauth/callback.tsx:40-70`). Check desktop `User` type fields first and match exactly.

```tsx
export function OAuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const action = parseOAuthCallbackParams({
        ticket: params.get("ticket") ?? undefined,
        error: params.get("error") ?? undefined,
        error_description: params.get("error_description") ?? undefined,
      });
      if (action.action === "redirect") { if (!cancelled) navigate("/", { replace: true }); return; }
      if (action.action === "failed") { if (!cancelled) setError(action.message); return; }
      try {
        const baseUrl = getApiBaseUrl();
        if (!baseUrl) throw new Error("Server not configured");
        const deviceId = await getDesktopDeviceId().catch(() => undefined);
        const { sessionToken, user } = await redeemOAuthTicket(action.ticket, { baseUrl, deviceId });
        // validate + store (mirror mobile): id finite number, openId non-empty string
        ...
        setSessionToken(sessionToken);
        setUserInfo(normalized);
        if (!cancelled) navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "OAuth sign-in failed");
      }
    })();
    return () => { cancelled = true; };
  }, [params, navigate]);

  if (!error) return null; // mirror mobile: blank while working
  return (
    <div>
      <h1>Sign-in failed</h1>
      <p>{error}</p>
      <Link to="/settings">Back to Settings</Link>
    </div>
  );
}
```

Match the file's existing styling idioms (read a simple desktop page first — plain tailwind classes, no new patterns). Import `Link` from `react-router`.

Web login URL + login branch (`use-auth.ts`):

```ts
export async function buildWebLoginUrl(): Promise<string> {
  const portal = getOAuthPortalUrl();
  if (!portal) return "";
  const deviceId = await getDesktopDeviceId().catch(() => undefined);
  const redirectUri = `${window.location.origin}/#/oauth/callback`;
  const url = new URL(`${portal}/app-auth`);
  url.searchParams.set("appId", getAppId());
  url.searchParams.set("redirectUri", redirectUri);
  if (deviceId) url.searchParams.set("deviceId", deviceId);
  url.searchParams.set("state", btoa(redirectUri));
  url.searchParams.set("type", "signIn");
  return url.toString();
}
```

Verify the portal's expected params by comparing with `buildLoginUrl` (`appId`, `redirectUri`, `state`, `type` — copy exactly, only redirectUri/deviceId differ). In `login()`: after the empty-URL guard, add at the top of try (before invoke):

```ts
const isTauri = typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__;
if (!isTauri) {
  const webUrl = await buildWebLoginUrl();
  if (!webUrl) { setError("OAuth portal is not configured"); return false; }
  window.location.href = webUrl;
  return true;
}
```

`window.location.href` in jsdom tests: setting href is a no-op-ish (jsdom logs "not implemented" for navigation) — existing login tests (if any call login without Tauri) could break; run `desktop/tests/auth*.test.tsx` + `use-auth` suites after. If breakage, gate with `try { window.location.href = ... } catch {}` — no, jsdom doesn't throw. Run suites and adapt ONLY on real failure.

Route: `<Route path="/oauth/callback" element={<OAuthCallback />} />` before `path="*"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test oauth-callback` (workdir: `desktop/`); `pnpm vitest run tests/oauth-handlers.test.ts` (root, Task 1 regression intact).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/OAuthCallback.tsx desktop/src/App.tsx desktop/src/hooks/use-auth.ts desktop/tests/oauth-callback.test.tsx
git commit -m "Feat: OAuth sign-in for desktop web via ticket callback. TypeScript: 0 errors."
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
