# Desktop Account Deletion — Design

Date: 2026-09-06. Scope: server-account delete in Danger Zone
(approved).

## Problem

Desktop Danger Zone only clears local data. Users with server
accounts cannot delete them from desktop; mobile can (About →
Delete My Data → server delete + logout + local wipe).

## Approach

Second Danger-Zone button using the existing REST endpoint
(`POST /api/auth/delete-account`, verified: Bearer auth accepted,
unlisted devices pass the revoked-only check, `{confirm: "DELETE"}`
required). No server changes. Local-only clear stays as its own
button.

## Flow

- `desktop/src/pages/Settings.tsx` Danger Zone, signed-in only: new
  "Delete account & data" button with its own two-step confirm
  (mirroring the existing `clearConfirm` pattern): confirm copy —
  "This permanently deletes your server account and all local data.
  This cannot be undone." + Yes, delete / Cancel.
- On confirm, strictly ordered:
  1. `POST {getApiBaseUrl()}/api/auth/delete-account` with
     `Authorization: Bearer <localStorage session token>` +
     `{confirm: "DELETE"}` (`credentials: "include"`). Non-OK →
     show server error, ABORT (no local wipe — account still
     exists server-side).
  2. `logout()` (desktop `use-auth`; sync function clearing token +
     user). Failure tolerated — step 3 removes the token anyway.
  3. `storage.clearAllData()` + `window.location.reload()` (same as
     existing clear handler).
- Signed-out users never see the button (no server account to
  delete; local clear covers their case). Deleting state disables
  both Danger-Zone buttons while in flight.

## Testing

- Source-guard tests: button + endpoint + confirm payload present;
  absent when signed out.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Email confirmation step, tRPC `deleteAccount` (REST matches
  mobile), mobile changes.
