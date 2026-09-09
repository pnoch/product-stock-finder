# Desktop Email/Password Auth — Design

Date: 2026-09-06. Scope: sign-in, sign-up, password change on
desktop (approved).

## Problem

Desktop sign-in is OAuth-portal only. Users with email/password
accounts cannot sign in, register, or rotate passwords from
desktop. Server endpoints exist (`POST /api/auth/register`,
`/login`, `/change-password` in `server/_core/oauth.ts`); desktop
session storage (`localStorage` token + user, subscriber notify)
already mirrors mobile web.

## Approach

Same REST endpoints and validation copy as mobile, inline in the
Account section where sign-in lives. Portal button stays. No
server changes.

## Auth functions

- `desktop/src/hooks/use-auth.ts`: `signInWithEmail(email,
  password)`, `signUpWithEmail(email, password, name?)`,
  `changePassword(currentPassword, newPassword)` — `fetch` with
  mobile-identical bodies (`{email, password[, name]}`,
  `{currentPassword, newPassword}`), `credentials: "include"`,
  error from `data.error` with matching fallbacks.
- On success store `sessionToken` + mapped `User` (`id, openId,
  name, email, loginMethod: "email", lastSignedIn, emailVerified`)
  via existing setters and call existing `notify()`.
- `changePassword` sends `Authorization: Bearer <stored token>`
  like mobile native.

## Sign-in UI

- Signed-out Account branch: Sign in / Create account tab toggle;
  email + password (+ name on register) inputs; register requires
  ≥6 chars; error text; success clears fields (session change
  re-renders to signed-in). Portal button retained below as
  alternative.

## Change password

- Signed-in Account branch: Current / New / Confirm inputs;
  validation copy mirrors mobile ("New passwords do not match",
  ≥6 chars implied by server); success toast + clear fields;
  errors inline.

## Testing

- Source-guard tests: three functions, UI wiring, validation
  strings. No live-auth tests (needs server + mailbox).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Portal changes, verification-email flow, auto-merge of
  OAuth/email identities, mobile/server changes.
