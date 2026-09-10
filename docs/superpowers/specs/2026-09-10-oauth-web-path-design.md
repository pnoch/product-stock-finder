# OAuth Web Path — Design Spec (2026-09-10)

Web/PWA desktop OAuth is stranded: `login()` only calls Tauri `start_oauth`, and there is no callback route. The ticket model already works in browsers (portal accepts `deviceId`, tickets are device-bound/single-use, redeem is plain HTTPS) — the gaps are the hardcoded scheme redirect and the missing route. Cookie sessions were rejected (dual model + CORS). Sub-project (b) of desktop web viability.

## §A — Server ticket redirect

`server/_core/oauth.ts` native branch: when `state.redirectUri` is a web http(s) URL passing the existing `resolveSafeRedirectUri` same-origin gate, redirect the ticket there instead of `productstockfinder:/oauth/callback`. Query-vs-hash placement (`origin/#/oauth/callback?ticket=`) resolved in planning. Scheme redirect otherwise unchanged. No new attack surface: target sanitized at creation and re-validated at use. Tests: existing scheme-redirect assertions keep passing; new test pins the web redirect.

## §B — Desktop web login + callback

`use-auth.ts` `buildLoginUrl` web variant: `redirectUri = window.location.origin + "/#/oauth/callback"` + `deviceId` from `getDesktopDeviceId`; sign-in uses full-page navigation; Tauri path unchanged. New `/oauth/callback` route reuses `parseOAuthCallbackParams` + `redeemOAuthTicket` from `lib/oauth-callback.ts`, stores the session via existing `setSessionToken`/`setUserInfo`/`mapUser`, navigates home; error states mirror mobile `app/oauth/callback.tsx`. Requires web origin to match configured `webBase` (defaults to API base) or the redirect safely falls back to `/`.

## Non-goals

- Cookie sessions; Bearer changes; email-auth changes; progress/UX beyond mobile parity; native flow changes.
