# `impit` Plain-HTTP Client (server-only) — Design Spec

**Date:** 2026-10-05
**Goal:** Give the server's plain-HTTP fetches a Chrome-shaped TLS/JA4 fingerprint so non-JS distributors that gate on TLS pass without a browser.

## Problem

The plain-HTTP path (`lib/scrapers/resilient.ts` `fetchPlain`, `lib/scrapers/utils.ts` `fetchWithRateLimit`) uses Node's global `fetch` (undici), whose TLS/JA4 handshake does not look like a real browser. The 2026 anti-detect benchmark showed TLS-fingerprint gates reward a Chrome-shaped client: `curl_cffi` (`impersonate="chrome"`) scored 26/31 with no JS engine, tying a 130 MB patched Chromium fork. `impit` is the Node binding for the same curl-impersonate approach.

## Scope

**In scope:** a server-only plain-HTTP client that uses `impit` (Chrome TLS shape) with a global-`fetch` fallback; route the two plain-fetch call sites through it.

**Out of scope:** the browser path (already Patchright, Phase 1103); mobile/web (they keep global `fetch`); the desktop Rust path; managed APIs/proxies.

## Architecture

### 1. New module `lib/scrapers/plain-fetch.ts`

A single decision point:

```ts
export async function plainFetch(
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
): Promise<Response>;
```

- **Server** (`typeof window === "undefined"` and `process.env.NODE_ENV !== "test"` and `process.env.VITEST` unset) → lazily `await import("impit")`, build a cached `new Impit({ browser: "chrome", timeout })`, and call `impit.fetch(url, init)`.
- **Mobile/web/test** → the global `fetch(url, init)` (so the 29 tests that stub `fetch` and the React Native path are unchanged).
- If the `impit` import or call throws, fall back to the global `fetch` (never fail the fetch because the impersonator is missing).
- `impit` is imported **lazily** so it never enters the mobile/web bundle or the node test transform.

### 2. Route the plain path through it

- `lib/scrapers/resilient.ts` `fetchPlain`: replace `await fetch(url, {...})` with `await plainFetch(url, {...})` (both the background and foreground branches).
- `lib/scrapers/utils.ts` `fetchWithRateLimit`: same replacement (both branches).

The existing UA/Accept/Accept-Language headers stay; `impit` adds the TLS shape on top.

### 3. Build

`package.json` `build` uses `esbuild --packages=external`, so `impit` (and its native `.node` binary) is externalized and loaded at runtime — no bundler change. `impit` ships prebuilt binaries for linux/mac/win × x64/arm64 × glibc/musl, covering the deploy.

## Error Handling

- `impit` unavailable (unsupported platform, missing binary) → global `fetch`.
- `impit` request error → propagate (the caller's retry/breaker logic is unchanged); only the *import/instantiation* failure falls back.
- Timeouts: pass the existing `AbortSignal` through; `impit` supports `signal`.

## Security & Privacy

- No new data flows; the same URLs and headers are sent.
- `impit` is Apify-maintained (Apache-2.0) and only used server-side.

## Testing

- `tests/scrapers/plain-fetch.test.ts` — under test env, `plainFetch` uses the global `fetch` (stub it and assert the call); with `impit` mocked and the server gate forced, it uses `impit.fetch`; a throwing `impit` import falls back to global `fetch`.
- `tests/scrapers/impit-guard.test.ts` — source guard: `impit` is imported only in `lib/scrapers/plain-fetch.ts`.
- Existing tests that stub global `fetch` remain green (they run under the test gate, so `plainFetch` delegates to global `fetch`).

## Risks & Mitigations

- **Native module** → prebuilt binaries cover the deploy targets; a load failure falls back to global `fetch`.
- **Test breakage** → the server gate excludes `NODE_ENV=test`/`VITEST`, so the 29 fetch-stubbing tests are unaffected.
- **TLS gates only** → helps non-JS distributors; JS-rendered/Cloudflare sites still use the browser path.

## Success Criteria

- On the server, plain-HTTP fetches use `impit` with a Chrome TLS shape; on mobile/web/tests they use global `fetch`.
- `pnpm verify` stays green; no mobile/web bundle change.
- TLS-gated non-JS distributors pass more often than with undici (measured against real targets).
