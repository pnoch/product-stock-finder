# Desktop Password Reset — Design

Date: 2026-09-06. Scope: forgot-request inline in Settings +
reset-confirm route (approved).

## Problem

Desktop auth is OAuth-portal based with no forgot/reset path: users
with email/password accounts (created on mobile) who forget their
password cannot recover from desktop. Server endpoints exist and are
public (`POST /api/auth/forgot`, `POST /api/auth/reset` in
`server/_core/oauth.ts`); mobile uses them via plain `fetch`.

## Approach

Same REST endpoints as mobile, no server changes. Forgot inline in
Settings (approved over separate route — sign-in lives there);
dedicated reset-confirm route for email links.

## Forgot form

- `desktop/src/pages/Settings.tsx`, signed-out Account branch below
  the Sign-in button: email input + "Send reset link" button.
- `POST {getApiBaseUrl()}/api/auth/forgot`, JSON `{email}`,
  `credentials: "include"` (mirror mobile `forgotPassword` in
  `hooks/use-auth.ts:174`); error text from `data.error` fallback
  "Failed to send reset email"; success → "Check your email for a
  reset link".
- Client validation: non-empty + contains "@" (keep minimal; server
  validates).

## Reset route

- `desktop/src/App.tsx`: `<Route path="/reset-password"
  element={<ResetPassword />} />` (public, before NotFound).
- New `desktop/src/pages/ResetPassword.tsx`: token from
  `useSearchParams`; no token → "Invalid Reset Link" + link to
  `/settings`.
- Form mirrors mobile validation copy (`app/reset-password.tsx`):
  both fields required, ≥6 chars, must match; error strings
  identical. `POST /api/auth/reset` `{token, newPassword}`;
  failure shows `data.error` fallback "Password reset failed";
  success shows confirmation + "Back to Settings" link (user signs
  in via portal after — no auto-sign-in).
- Loading state disables the form while requesting.

## Testing

- Source-guard tests: forgot form posts to `/api/auth/forgot`;
  reset page posts token + password to `/api/auth/reset` and handles
  missing token.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- SMTP/email template/portal changes; auto-sign-in after reset.
- Mobile code untouched.
